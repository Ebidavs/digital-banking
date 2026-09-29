# Digital Banking Backend

A Node.js, Express, and MongoDB banking API integrated with the
NibssByPhoenix test platform. Only synthetic BVN/NIN values are used.

## Setup
1. Install Node.js and MongoDB Community Server.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and supply local credentials.
4. Start MongoDB.
5. Run `npm run dev`.
6. Check `GET http://localhost:8000/api/health`.

## Customer flow
Register → login → create and validate test BVN or NIN →
create one account → name enquiry → transfer → balance and history.

## Local API
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/identity/bvn
- POST /api/identity/nin
- POST /api/accounts
- GET /api/accounts/me
- GET /api/banking/balance
- GET /api/banking/name-enquiry/:accountNumber
- POST /api/banking/transfers
- GET /api/banking/transfers
- GET /api/banking/transfers/:id

Customer routes use the customer's Bearer token. Provider API keys remain
server-side. Account and transaction lookups use the authenticated customer ID.

## Verified test
Two BVN customers received one account each, initially funded with ₦15,000.
A ₦100 transfer changed the sender and recipient balances to ₦14,900 and
₦15,100. The local outgoing transaction is marked successful after checking
both balances. [Add the NIN and privacy test results after completing them.]

## Known limitation
The provider transaction ID (TSQ) was not captured for the first transfer.
Its local result was confirmed by the controlled balance checks. A transfer
with an uncertain outcome is held for review and must not be retried blindly.