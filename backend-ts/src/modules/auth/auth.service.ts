/**
 * Auth service. Mirrors Python `app/routes/auth.py`.
 *
 * Login OTP is mocked (env MOCK_OTP, default 123456) for dev. Each user is
 * assigned a sticky 4-digit `ride_pin` on first signup which is reused for
 * every ride they book (so the passenger always shares the same PIN with
 * drivers).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ADMIN_PHONES, MOCK_OTP } from '../../config/constants';
import { JwtService } from '../../common/jwt.service';
import { clean, genPin, maskPhone, newId, now } from '../../common/utils';
import { User } from '../../db/schemas/user.schema';
import { Driver } from '../../db/schemas/driver.schema';
import { SendOtpDto, VerifyOtpDto } from './auth.dto';

const NAME_RE = /^[A-Za-z][A-Za-z .'\-]{1,49}$/;

function isValidName(value: string): boolean {
  return NAME_RE.test(value.trim());
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('fifthdigit.auth');

  // In-memory OTP store (phone -> {otp, expiresAt}) — login OTPs are NOT sticky
  private readonly otpStore = new Map<string, { otp: string; expiresAt: Date }>();

  constructor(
    private readonly jwt: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Driver.name) private readonly driverModel: Model<Driver>,
  ) {}

  async sendOtp(req: SendOtpDto) {
    const phone = req.phone.trim();
    if (phone.length !== 10 || !/^\d+$/.test(phone)) {
      throw new BadRequestException('Phone must be 10 digits');
    }
    const adminList = ADMIN_PHONES.map((p) => p.trim());
    if (req.role === 'admin' && !adminList.includes(phone)) {
      throw new ForbiddenException('This phone is not registered as admin');
    }
    const expiresAt = new Date(now().getTime() + 5 * 60 * 1000);
    this.otpStore.set(phone, { otp: MOCK_OTP, expiresAt });
    // Never log the OTP itself at info level. Keep the literal at debug only.
    this.logger.log(`OTP issued phone=${maskPhone(phone)} role=${req.role}`);
    this.logger.debug(`OTP value for ${maskPhone(phone)}: ${MOCK_OTP}`);
    return { message: 'OTP sent', dev_otp: MOCK_OTP };
  }

  async verifyOtp(req: VerifyOtpDto) {
    const phone = req.phone.trim();
    const rec = this.otpStore.get(phone);
    if (!rec) throw new BadRequestException('OTP not requested');
    if (rec.expiresAt < now()) throw new BadRequestException('OTP expired');
    if (req.otp !== rec.otp) {
      this.logger.warn(
        `OTP verification failed phone=${maskPhone(phone)} role=${req.role}`,
      );
      throw new BadRequestException('Invalid OTP');
    }

    let user: any = await this.userModel.findOne({ phone }).lean();
    let isNew = false;
    const adminPhoneList = ADMIN_PHONES.map((p) => p.trim());

    if (user) {
      if (user.role !== req.role) {
        throw new ForbiddenException(
          `This phone is registered as ${user.role}`,
        );
      }
      if (!(user.name || '').trim()) {
        // legacy user without name — ask client to supply one
        const name = (req.name || '').trim();
        if (!name) return { requires_name: true, is_new_user: false };
        if (!isValidName(name)) {
          throw new BadRequestException(
            "Name should only contain letters, spaces, dots, hyphens, or apostrophes",
          );
        }
        await this.userModel.updateOne({ id: user.id }, { $set: { name } });
        user.name = name;
      }
      // Backfill ride_pin for legacy accounts
      if (!user.ride_pin) {
        const pin = genPin();
        await this.userModel.updateOne(
          { id: user.id },
          { $set: { ride_pin: pin } },
        );
        user.ride_pin = pin;
      }
    } else {
      if (req.role === 'admin') {
        // Auto-seed an authorised admin on first OTP verify so an admin never
        // gets locked out by a missing seed run.
        if (!adminPhoneList.includes(phone)) {
          throw new ForbiddenException('This phone is not registered as admin');
        }
        user = {
          id: newId(),
          phone,
          name: 'FifthDigit Admin',
          role: 'admin',
          ride_pin: genPin(),
          created_at: now(),
        };
        await this.userModel.create(user);
        isNew = true;
      } else {
        isNew = true;
        const name = (req.name || '').trim();
        if (!name) return { requires_name: true, is_new_user: true };
        if (!isValidName(name)) {
          throw new BadRequestException(
            "Name should only contain letters, spaces, dots, hyphens, or apostrophes",
          );
        }
        user = {
          id: newId(),
          phone,
          name,
          role: req.role,
          ride_pin: genPin(), // sticky PIN reused for every ride this user books
          created_at: now(),
        };
        await this.userModel.create(user);
        if (req.role === 'driver') {
          await this.driverModel.create({
            id: newId(),
            user_id: user.id,
            kyc_status: 'not_submitted',
            online: false,
            earnings_total: 0.0,
            earnings_withdrawn: 0.0,
            created_at: now(),
          });
        }
      }
    }

    this.otpStore.delete(phone);
    const token = this.jwt.makeToken(user.id, user.role);
    if (isNew) {
      this.logger.log(
        `New ${user.role} signed up user=${user.id} phone=${maskPhone(phone)}`,
      );
    } else {
      this.logger.log(`User logged in user=${user.id} role=${user.role}`);
    }
    return {
      access_token: token,
      user: clean(user),
      is_new_user: isNew,
    };
  }

  async me(user: any) {
    const out: any = { user: clean(user) };
    if (user.role === 'driver') {
      const driver = await this.driverModel
        .findOne({ user_id: user.id })
        .lean();
      out.driver = driver ? clean(driver) : null;
    }
    return out;
  }
}
