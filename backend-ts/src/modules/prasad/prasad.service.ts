/**
 * Prasad ordering. Users pick prasad items offered by a temple and pay.
 * Payments are in TEST MODE for now: the order is recorded as paid immediately
 * (no real gateway). Swap `markTestPaid` for a real provider (Razorpay, etc.)
 * later without touching the order shape.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { clean, newId, now, round } from '../../common/utils';
import { Temple } from '../../db/schemas/temple.schema';
import { PrasadOrder } from '../../db/schemas/prasad-order.schema';
import { CreatePrasadOrderDto } from './prasad.dto';

@Injectable()
export class PrasadService {
  private readonly logger = new Logger('fifthdigit.prasad');

  constructor(
    @InjectModel(Temple.name) private readonly templeModel: Model<Temple>,
    @InjectModel(PrasadOrder.name)
    private readonly orderModel: Model<PrasadOrder>,
  ) {}

  async createOrder(dto: CreatePrasadOrderDto, user: any) {
    const temple = await this.templeModel
      .findOne({ id: dto.temple_id })
      .lean();
    if (!temple) throw new NotFoundException('Temple not found');

    const catalog: any[] = ((temple as any).prasad_items || []) as any[];
    const byId = new Map(catalog.map((p) => [p.id, p]));

    const lines = dto.items.map((it) => {
      const item = byId.get(it.item_id);
      if (!item) {
        throw new BadRequestException(`Prasad item unavailable: ${it.item_id}`);
      }
      if (item.available === false) {
        throw new BadRequestException(`"${item.name}" is currently unavailable`);
      }
      const qty = Math.max(1, Math.floor(it.qty));
      return {
        item_id: item.id,
        name: item.name,
        price: Number(item.price),
        qty,
        subtotal: round(Number(item.price) * qty, 2),
      };
    });

    const total = round(
      lines.reduce((s, l) => s + l.subtotal, 0),
      2,
    );
    if (total <= 0) throw new BadRequestException('Order total must be positive');

    const ts = now();
    const doc: any = {
      id: newId(),
      user_id: user.id,
      temple_id: (temple as any).id,
      temple_name: (temple as any).name,
      items: lines,
      total,
      currency: 'INR',
      // TEST MODE: mark paid immediately (no real gateway yet).
      status: 'paid',
      payment: { mode: 'test', status: 'paid', paid_at: ts },
      contact_phone: dto.contact_phone || user.phone || null,
      created_at: ts,
      updated_at: ts,
    };
    await this.orderModel.create(doc);
    this.logger.log(
      `Prasad order created id=${doc.id} temple=${doc.temple_id} total=${total} (test paid) user=${user.id}`,
    );
    return clean(doc);
  }

  async listMine(user: any) {
    const orders = await this.orderModel
      .find({ user_id: user.id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();
    return { orders: (orders as any[]).map((o) => clean(o)) };
  }

  async adminList(templeId?: string) {
    const q: any = {};
    if (templeId) q.temple_id = templeId;
    const orders = await this.orderModel
      .find(q)
      .sort({ created_at: -1 })
      .limit(500)
      .lean();
    return { orders: (orders as any[]).map((o) => clean(o)) };
  }
}
