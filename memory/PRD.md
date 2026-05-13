# TirthRide — Product Requirements Document

## Vision
A reliable, government-grade e-rickshaw booking + management app for Govardhan (Mathura district) covering Jatipura, Anyor, Poochari, Radhakund. Serves locals + tourists doing parikrama. Doubles as an audit/management tool for the app owners and govt.

## Roles
1. **Passenger** — books rides
2. **Driver** — accepts rides, KYC required
3. **Admin** — manages fares, drivers, audit, configs

## Core Flows

### Authentication
- Phone OTP (mock `123456`). Auto-creates user on first verify.
- Role selected before phone entry; persisted per phone.
- Admin phones are pre-seeded (`9999999999`).
- JWT access token stored in AsyncStorage.

### Passenger
- **Home**: 3 service tiles — Local Ride, Poochari Parikrama (12 km), Radhakund Parikrama (7 km), Combined.
- **Local Ride**: pickup + drop selected from a curated list of Govardhan landmarks (city boundary enforced; admin-configurable). Fare = base + per-km × distance.
- **Parikrama**: fixed admin-set package price.
- **Booking**: choose payment (UPI/Cash), confirm → driver search → status timeline.
- **PIN**: 4-digit displayed to passenger; driver enters it to start ride.
- **Future booking**: schedule for later; driver assignment 30 min before pickup.
- **Cancel**: reason required.
- **Past rides** + profile edit.

### Driver
- **KYC**: aadhar number + photo, vehicle number, vehicle RC photo, UPI ID, profile photo. Submitted → pending → admin approves/rejects.
- **Vehicle change** flips kyc_status back to pending (re-verification).
- **Home**: online/offline toggle. Polls for matching ride requests.
- **Incoming ride**: accept / pass. Once accepted, sees passenger info + PIN entry.
- **Earnings**: total + withdrawable balance. Withdraw to UPI request.
- **Suggest fare** for admin voting.

### Admin
- **Dashboard**: rides today, active drivers, revenue, pending approvals.
- **Fares**: base fare, per-km, Poochari, Radhakund, Combined, commission %, city center radius.
- **Driver approval**: see KYC docs, approve/reject with note.
- **Audit log**: every ride with full state transitions and cancellation reasons.
- **Suggestions**: vote on driver-suggested fares; winner becomes new fare.

## Data Model (MongoDB)
- `users`: phone, name, role, created_at
- `drivers`: user_id, aadhar_no, aadhar_photo, vehicle_no, vehicle_type, rc_photo, profile_photo, upi_id, kyc_status, online, earnings_total, earnings_withdrawn
- `rides`: passenger_id, driver_id, type (local/poochari/radhakund/combined), pickup, drop, distance_km, fare, commission, payment_method, status (requested/accepted/started/completed/cancelled), pin, scheduled_at, cancel_reason, cancelled_by, audit_log[], created_at, started_at, completed_at
- `fare_config` (singleton): base_fare, per_km, parikrama prices, commission_pct, city_boundary, landmarks[]
- `fare_suggestions`: driver_id, ride_type, amount, votes_up, votes_down, status
- `withdrawals`: driver_id, amount, upi_id, status, requested_at

## Tech Stack
- Backend: FastAPI + Motor (MongoDB) + python-jose JWT
- Frontend: Expo SDK 54 + expo-router + AsyncStorage
- Design: Warm earthy palette (#E68A00 primary), Feather icons, light theme

## Out of Scope (MVP)
- Real SMS OTP (mocked)
- Live GPS map tracking (status timeline only)
- Real payment gateway (UPI/Cash recorded only, no actual payment flow)
- Push notifications via Expo Push (in-app polling instead)

## Next Iterations
- Twilio/MSG91 SMS
- Google Maps Places + live driver location
- Expo Push notifications
- Real UPI payment via Razorpay/Stripe
