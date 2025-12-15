# Community Connect Backend – API for Membership & Event Management for Local Clubs

---

## 🌐 Live API
[https://community-connect-bd.vercel.app/](https://community-connect-bd.vercel.app/) (Deployed on Vercel)

---

## 🚀 Project Overview
**Community Connect Backend** is the server-side component of a full-stack MERN application that powers the discovery, joining, and management of local clubs in Bangladesh. It handles user authentication, role-based access control, CRUD operations for clubs and events, secure Stripe payments for memberships and event registrations, and MongoDB data management. The API is designed to be secure, scalable, and integrated with Firebase for authentication and JWT for token verification.

This backend ensures all sensitive operations (e.g., payments, role changes) are handled server-side, with middleware for token validation and role checks.

---

## 🎯 Project Goal
To provide a robust, secure API that:
- Manages user roles (Admin, Club Manager, Member) and permissions
- Handles club approvals, memberships, events, and registrations
- Processes payments securely via Stripe (test mode)
- Supports server-side filtering, sorting, and searching for clubs and events
- Integrates with MongoDB for efficient data storage and retrieval

---

## 🛠 Key Features
- **RESTful API Endpoints**: CRUD for users, clubs, memberships, events, event registrations, and payments
- **Authentication & Authorization**: Firebase token verification middleware; JWT issuance and validation; role-based access (e.g., only Admins can approve clubs or change roles)
- **Payment Integration**: Stripe payment intents/sessions created server-side for memberships and paid events; handles free/paid logic and updates records on success
- **Database Management**: MongoDB collections (users, clubs, memberships, events, eventRegistrations, payments) with relationships (e.g., managerEmail as FK)
- **Search, Filter & Sort**: Server-side queries for clubs (by name/category) and events (by date/fee/createdAt) using MongoDB aggregation and .sort()
- **Admin Tools**: Endpoints for overview stats (total users/clubs/memberships/events/payments), user role management, club approval/rejection
- **Club Manager Tools**: Restricted endpoints for managing owned clubs/events, viewing members/registrations/payments
- **Member Tools**: Endpoints for viewing/joining clubs, registering events, payment history
- **Security**: Environment variables for secrets (MongoDB URI, Stripe key, JWT secret); no CORS/404/504 issues; protected routes
- **Error Handling**: User-friendly error responses; logging for production

---

## 📊 Database Collections
Implemented as per specifications:

- **users**: name, email, photoURL, role (admin/clubManager/member), createdAt
- **clubs**: clubName, description, category, location, bannerImage, membershipFee, status (pending/approved/rejected), managerEmail, createdAt/updatedAt
- **memberships**: userEmail, clubId, status (active/expired/pendingPayment), paymentId, joinedAt/expiresAt
- **events**: clubId, title, description, eventDate, location, isPaid, eventFee, maxAttendees, createdAt
- **eventRegistrations**: eventId, userEmail, clubId, status (registered/cancelled), paymentId, registeredAt
- **payments**: userEmail, amount, type (membership/event), clubId/eventId, stripePaymentIntentId, status, createdAt

---

## 🔥 Additional Highlights
- Server-side filtering, sorting, and searching using MongoDB queries (e.g., .find(), .aggregate(), .sort())
- JWT middleware for all protected routes, verifying Firebase tokens and user roles
- Environment-based configuration with .env for secrets (no exposures)
- Production-ready: No CORS issues, handles valid routes without errors

---

## 💻 Tech Stack
- Node.js
- Express.js
- MongoDB (via Mongoose)
- Firebase Admin SDK (for token verification)
- JSON Web Token (JWT)
- Stripe
- Dotenv
- Cors
- Other: body-parser, etc.

## 📦 Important NPM Packages
- express
- mongoose
- jsonwebtoken
- stripe
- firebase-admin
- dotenv
- cors
- body-parser

---

## 🛠 Installation & Setup
1. Clone the repository:
   ```
   git clone https://github.com/mdnurnabirana/community-connect-backend.git
   cd community-connect-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/community-connect?retryWrites=true&w=majority
   JWT_SECRET=your_jwt_secret
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   FIREBASE_SERVICE_ACCOUNT=your_firebase_service_account_json (base64 encoded or path)
   ```

4. Run the server:
   - Development: `npm run dev` (using nodemon)
   - Production: `npm start`

5. The API will be available at `http://localhost:5000`.

---

## 🔑 API Usage Notes
- All protected endpoints require Authorization header with JWT (e.g., `Bearer <token>`)
- Example: POST `/api/auth/verify` to issue JWT after Firebase login
- Test with Postman or integrate with the frontend
- Deployed on Vercel for production; ensure env vars are set in Vercel dashboard

---

## 📝 Author
Md Nurnabi Rana 
Email: [mdnurnabirana.cse@gmail.com](mailto:mdnurnabirana.cse@gmail.com)  
GitHub: [https://github.com/mdnurnabirana](https://github.com/mdnurnabirana)