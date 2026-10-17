# ServicePilot — Architecture & MVP Roadmap

> **Purpose:** This file is the persistent architecture and development roadmap for ServicePilot.
>
> **IMPORTANT:** Before implementing any new feature, inspect this roadmap AND inspect the actual repository. The repository is the source of truth for what has actually been implemented. This roadmap is the source of truth for the intended architecture, MVP scope, constraints, and development direction.
>
> Do not assume a feature is complete merely because it appears in this document. Verify the actual code, Prisma schema, migrations, routes, services, controllers, middleware, validators, tests, and frontend implementation.

---

# 1. Product Definition

ServicePilot is a multi-tenant SaaS "operating system" for small service businesses such as:

* AC repair
* Electricians
* Plumbers
* Appliance repair
* HVAC
* RO / water purifier service
* Other local service businesses

These businesses often manage operations through:

* WhatsApp
* Phone calls
* Notebooks
* Spreadsheets

ServicePilot replaces that fragmented workflow with one system where:

* A business owner manages customers, technicians, and jobs.
* Technicians update assigned work from the field.
* Customers interact through a lightweight link-based interface.
* The complete service lifecycle is captured digitally.

Core lifecycle:

```text
Service Request
    ↓
Job Created
    ↓
Technician Assigned
    ↓
Technician Work
    ↓
Parts / Charges
    ↓
Photos
    ↓
Job Completed
    ↓
Customer Confirmation
    ↓
Digital Signature
    ↓
Payment
    ↓
Review
    ↓
Optional Tip
    ↓
Digital Receipt
    ↓
Customer Service History
```

The goal of the MVP is to prove this core workflow end-to-end using real data integrity and strict tenant isolation.

---

# 2. Exact MVP Scope

The MVP includes:

* Business registration
* Owner authentication
* Owner profile photo upload (optional)
* Technician CRUD
* Technician profile photo upload (optional)
* Customer CRUD
* Customer service history
* Job creation
* Job assignment
* Job status state machine
* Job status history
* Technician job updates
* Work performed
* Parts
* Additional charges
* Notes
* Basic job photo upload
* Customer completion confirmation
* Simple customer signature capture
* Manual payment recording
* Correct total calculation
* Customer review
* Optional tip
* Digital receipt
* Strict multi-tenant isolation

---

# 3. Profile Photo Requirement

## Owner

During business/owner registration, the owner should have an option to upload a profile photo.

The profile photo is:

* Optional
* Associated with the owner's `User` record
* Not required for successful registration
* Stored as a URL/path in the database
* Not stored as a binary/blob inside PostgreSQL

Example:

```text
User
├── id
├── businessId
├── name
├── email
├── passwordHash
├── role
└── profilePhotoUrl
```

If the owner does not upload a photo:

```text
profilePhotoUrl = null
```

## Technician

When an owner creates a technician, the owner should also have the option to upload a technician profile photo.

The technician's photo is also optional.

Example:

```text
Technician/User
├── id
├── businessId
├── name
├── email
├── passwordHash
├── role
└── profilePhotoUrl
```

## MVP Storage

Do NOT implement S3 as part of the MVP.

For MVP:

* Local disk storage is acceptable.
* A stub URL is acceptable.
* Database stores only the URL/path.

Example:

```text
/profile-photos/user-123.jpg
```

or:

```text
/uploads/profile-photos/user-123.jpg
```

## V1

Real object storage should be introduced later using:

* Amazon S3 or equivalent
* Presigned upload URLs
* Proper file validation
* Secure object access

Do not prematurely build the S3 architecture during the MVP.

---

# 4. Explicitly NOT in MVP

The following are deliberately deferred:

* Real WhatsApp sending
* Real SMS sending
* Real email sending
* Socket.IO realtime chat
* Redis caching
* Razorpay live payments
* Stripe live payments
* S3 presigned uploads
* BullMQ background jobs
* Rate limiting
* Audit log system
* Advanced observability stack
* Docker / CI-CD
* Customer accounts/login
* Customer passwords

Customers interact through a signed/scoped job link instead of creating an account.

MVP messaging/broadcast functionality, if needed architecturally, can initially be represented as in-app records rather than real external delivery.

---

# 5. User Roles

## OWNER

Full control over their own business:

* Customers
* Technicians
* Jobs
* Payments
* Receipts
* Business-related data

Cannot:

* Access another business's data.

---

## TECHNICIAN

Can:

* Log in
* See assigned jobs
* Update assigned jobs
* Record work
* Add parts
* Add charges
* Add notes
* Add photos
* Complete assigned work

Cannot:

* See another technician's jobs
* Access unrelated business-wide data
* Access another business's data

---

## CUSTOMER

Customers do not have a traditional login.

They receive a scoped job link/token.

They can:

* View their job
* Confirm completion
* Sign
* View receipt
* Submit review
* Add optional tip

They cannot:

* Access another job
* Access another customer's data
* Access business-wide information
* Access anything outside their scoped job/token

---

# 6. Complete Business Workflow

```text
CUSTOMER
    ↓
SERVICE REQUEST
    ↓
OWNER CREATES JOB
    ↓
Select/Create Customer
    ↓
Describe Problem
    ↓
Schedule Job
    ↓
TECHNICIAN ASSIGNED
    ↓
TECHNICIAN ACCEPTS / STARTS
    ↓
ASSIGNED
    ↓
ON_THE_WAY
    ↓
IN_PROGRESS
    ↓
TECHNICIAN RECORDS WORK
    ↓
Problem Found
    ↓
Work Performed
    ↓
Parts Added
    ↓
Additional Charges Added
    ↓
Notes Added
    ↓
Before/After Photos
    ↓
COMPLETED
    ↓
CUSTOMER CONFIRMS COMPLETION
    ↓
CUSTOMER SIGNS
    ↓
PAYMENT RECORDED
    ↓
CUSTOMER REVIEW
    ↓
OPTIONAL TIP
    ↓
DIGITAL RECEIPT
    ↓
CUSTOMER SERVICE HISTORY UPDATED
```

---

# 7. System Architecture

```text
┌─────────────────────┐
│     Owner Web App   │
│     React / Vite    │
└──────────┬──────────┘
           │
           │ JWT
           │ Access + Refresh
           │ httpOnly Cookies
           │
┌──────────▼──────────┐
│  Technician Web App │
│     React / Vite    │
└──────────┬──────────┘
           │
           │ JWT
           │
┌──────────▼──────────┐
│ Customer Link Page  │
│     React           │
└──────────┬──────────┘
           │
           │ Scoped Job Token
           │
           ▼
┌────────────────────────────┐
│      Express API Server    │
│                            │
│ routes                     │
│    ↓                       │
│ controllers                │
│    ↓                       │
│ services                   │
│    ↓                       │
│ Prisma                     │
│                            │
│ Middleware:                │
│ - Authentication           │
│ - RBAC                     │
│ - Tenant Scoping           │
│ - Validation / Zod         │
│ - Error Handling           │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│        PostgreSQL          │
│                            │
│ RDS / Neon / Local Docker  │
└────────────────────────────┘
```

## V1 additions

```text
Socket.IO
S3
Redis
Razorpay
```

## Advanced additions

```text
BullMQ
Structured Logging
Rate Limiting
Audit Logs
Observability
```

---

# 8. Authentication Architecture

Authentication uses:

* JWT
* Access token
* Refresh token
* httpOnly cookies
* bcrypt password hashing

Expected authentication endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

The JWT should contain enough identity/context to establish the authenticated user, such as:

```text
userId
businessId
role
```

Never trust `businessId` supplied by the client.

The server derives tenant identity from the authenticated session/token.

---

# 9. Multi-Tenant Isolation

ServicePilot is a multi-tenant application.

A business must only be able to access its own data.

Every request involving an authenticated owner/technician must derive:

```text
businessId
```

from the authenticated user/session.

For customer requests, tenant/job scope comes from the signed/scoped job token.

## Critical Rule

Never accept this from the client:

```json
{
  "businessId": "some-business-id"
}
```

and trust it.

Instead:

```text
JWT
 ↓
authenticateToken
 ↓
req.user.businessId
 ↓
service layer
 ↓
Prisma query filtered by businessId
```

Every Prisma query involving tenant-owned data must enforce tenant scope.

Example concept:

```text
WHERE businessId = authenticatedUser.businessId
```

---

# 10. Authorization Model

Authorization is not just role checking.

ServicePilot uses:

```text
ROLE
+
RESOURCE OWNERSHIP
+
TENANT ISOLATION
```

Every protected operation should conceptually answer:

1. Who is the user?
2. What role do they have?
3. Which business do they belong to?
4. Does the requested resource belong to that business?
5. If technician, is this job actually assigned to them?
6. If customer, does the token authorize access to this exact job?

Example:

```text
Valid JWT
≠
Permission to access every job
```

A technician with a valid token must not automatically be able to modify every job.

---

# 11. Database Design — MVP

## Business

Represents the tenant/business.

Everything else belongs to a business either directly or indirectly.

Example:

```text
Business
- id
- name
- createdAt
- updatedAt
```

---

## User

Represents owner and technician accounts.

Example:

```text
User
- id
- businessId
- name
- email
- passwordHash
- role
- profilePhotoUrl
- createdAt
- updatedAt
```

Roles:

```text
OWNER
TECHNICIAN
```

`profilePhotoUrl` is optional.

The database stores the URL/path, not the actual image binary.

---

## Customer

Belongs to a business.

Fields:

```text
Customer
- id
- businessId
- name
- phone
- email (optional)
- address
- notes
- createdAt
- updatedAt
```

Constraint:

```text
UNIQUE (businessId, phone)
```

This prevents duplicate customer phone numbers within the same business while allowing the same phone number to exist in different businesses.

---

## Job

The central object in the system.

Fields:

```text
Job
- id
- businessId
- customerId
- technicianId (nullable until assigned)
- status
- problemDescription
- scheduledAt
- serviceCharge
- discount
- createdById
- createdAt
- updatedAt
```

---

## JobStatusHistory

Stores every status transition.

Fields:

```text
JobStatusHistory
- id
- jobId
- fromStatus
- toStatus
- changedById
- changedAt
```

This provides an accountability trail.

Do not simply allow:

```text
job.status = "COMPLETED"
```

from anywhere.

Status transitions must follow explicit business rules.

---

## JobPart

Represents parts/materials used during a job.

Fields:

```text
JobPart
- id
- jobId
- name
- quantity
- unitCost
```

There is intentionally no global Part catalog in the MVP.

A global catalog can be added later if actual product requirements justify it.

---

## JobCharge

Optional for MVP.

The simplest MVP design can instead store:

```text
additionalCharges
additionalChargeDescription
```

directly on the Job.

A proper itemized charge table can be introduced later.

Do not over-normalize the database before there is a real requirement.

---

## Payment

MVP supports manual payment recording.

Fields:

```text
Payment
- id
- jobId
- amount
- method
- status
- paidAt
```

Payment methods:

```text
CASH
UPI
CARD
OTHER
```

Payment statuses:

```text
PENDING
PAID
PARTIAL
```

MVP can use one payment record per job.

V1 can support multiple payments/partial-payment records if required.

---

## Tip

Fields:

```text
Tip
- id
- jobId
- technicianId
- amount
- paymentStatus
```

Tips are stored but not processed through a real payment gateway in the MVP.

---

## Review

Fields:

```text
Review
- id
- jobId
- customerId
- technicianId
- rating
- comment
```

---

## JobPhoto

Fields:

```text
JobPhoto
- id
- jobId
- url
- type
```

Types:

```text
BEFORE
AFTER
```

For MVP:

* Store a URL/path.
* Local disk is acceptable.
* Stub URL is acceptable.

Do not store photo binary data inside PostgreSQL.

V1:

```text
S3 / object storage
+
presigned upload URLs
```

---

## Signature

Fields:

```text
Signature
- id
- jobId
- signatureData
- signedAt
- ipAddress (optional)
```

MVP:

```text
Canvas
 ↓
Base64/text representation
 ↓
Database
```

V1 can move signature/image storage to object storage.

---

## Receipt

Receipt does not need to be a physical database table in MVP.

Compute it from:

```text
Job
+
JobPart
+
Payment
+
Tip
```

at request time.

A physical immutable Receipt table can be introduced later when point-in-time snapshots are required.

---

## Message / Conversation

Deferred to V1.

MVP does not need persistent chat.

---

# 12. Database Relationships

```text
Business
 ├── 1:N User
 ├── 1:N Customer
 └── 1:N Job

Customer
 └── 1:N Job

User (Technician)
 └── 1:N Job

Job
 ├── 1:N JobStatusHistory
 ├── 1:N JobPart
 ├── 1:N JobPhoto
 ├── 1:1 Payment
 ├── 1:1 Signature
 ├── 1:1 Review
 └── 1:1 Tip
```

---

# 13. Database Constraints & Indexes

Customer:

```text
UNIQUE (businessId, phone)
```

Job indexes:

```text
businessId
status
technicianId
customerId
```

Enums:

```text
Role
JobStatus
PaymentMethod
PaymentStatus
```

---

# 14. Backend Architecture

Expected structure:

```text
BACKEND/
└── src/
    ├── config/
    │   └── env / Prisma client
    │
    ├── middleware/
    │   ├── auth
    │   ├── rbac
    │   ├── tenantScope
    │   └── errorHandler
    │
    ├── validators/
    │   └── Zod schemas
    │
    ├── controllers/
    │   └── HTTP request/response handling
    │
    ├── services/
    │   └── business logic + Prisma
    │
    ├── routes/
    │   └── API route definitions
    │
    └── utils/
        ├── token helpers
        ├── password helpers
        └── response helpers

    prisma/
    └── schema.prisma
```

---

# 15. Layer Responsibilities

## Controller

Controller translates:

```text
HTTP request
      ↕
Service
```

Controller responsibilities:

* Read request data
* Call service
* Return HTTP response
* Translate successful result to API response

Controllers should NOT contain:

* Prisma queries
* Core business rules
* Complex authorization logic
* Database calculations

---

## Service

Service owns:

* Business logic
* Prisma calls
* State machine rules
* Total calculations
* Tenant scoping
* Resource ownership checks

This is where questions like:

```text
Can this technician update this job?
```

should ultimately be decided.

---

## Middleware

Middleware handles cross-cutting concerns such as:

### Authentication

```text
Verify JWT
 ↓
Attach req.user
```

### Authorization

```text
Check role
```

### Tenant Scope

```text
Ensure request operates within authenticated business
```

### Error Handling

Centralized translation of application errors into HTTP responses.

---

## Validators

Use Zod schemas before controllers process request bodies.

Purpose:

```text
Bad input
 ↓
Reject early
```

Validation is not authentication.

Validation is not authorization.

---

## Error Handling

Use typed application errors, for example:

```text
AppError(status, message)
```

Expected errors should be handled centrally.

Controllers should not contain repetitive catch blocks for every expected business error.

---

# 16. Frontend Architecture

## Owner App

MVP screens:

```text
Login
Register
    ↓
Dashboard
    ↓
Customers
    ├── List
    ├── Detail
    └── Create
    ↓
Technicians
    ├── List
    └── Create
    ↓
Jobs
    ├── List
    ├── Create
    └── Detail
        ├── Status
        └── Assignment
    ↓
Payments / Receipts
```

Owner registration should support:

```text
Name
Email
Password
Business Name
Optional Profile Photo
```

Technician creation should support:

```text
Name
Email
Password / credentials
Optional Profile Photo
```

---

## Technician App

MVP screens:

```text
My Jobs
    ↓
Job Detail
    ├── Status Update
    ├── Work Notes
    ├── Parts
    ├── Charges
    ├── Photo
    └── Completion
```

Technician profile should be able to display the optional profile photo.

---

## Customer Page

No login.

Token-based access:

```text
Job Summary
    ↓
Confirm Completion
    ↓
Sign
    ↓
View Receipt
    ↓
Review
    ↓
Optional Tip
```

---

# 17. API Module Structure — MVP

## Authentication

```http
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

---

## Customers

```http
GET /customers
POST /customers
GET /customers/:id
PATCH /customers/:id
```

---

## Technicians

```http
GET /technicians
POST /technicians
GET /technicians/:id
PATCH /technicians/:id
```

Technician creation/update should support optional profile photo information.

---

## Jobs

```http
GET /jobs
POST /jobs
GET /jobs/:id
PATCH /jobs/:id

PATCH /jobs/:id/assign
PATCH /jobs/:id/status

POST /jobs/:id/parts
POST /jobs/:id/photos
```

---

## Payments

```http
POST /jobs/:id/payment
GET /jobs/:id/payment
```

---

## Customer-facing token routes

```http
GET /public/jobs/:token
POST /public/jobs/:token/confirm
POST /public/jobs/:token/sign
POST /public/jobs/:token/review
POST /public/jobs/:token/tip
```

---

## Receipt

```http
GET /jobs/:id/receipt
```

Receipt is computed from stored data in the MVP.

---

# 18. Authorization Requirements

Authorization must be enforced at multiple levels.

For owner/technician routes:

```text
Authentication
      ↓
Role Check
      ↓
Tenant Check
      ↓
Resource Ownership Check
      ↓
Business Logic
```

Example:

A technician requests:

```http
PATCH /jobs/job-123/status
```

The system must verify:

```text
JWT valid?
        ↓
User is TECHNICIAN?
        ↓
Job belongs to same business?
        ↓
Job assigned to this technician?
        ↓
Requested status transition allowed?
        ↓
Update job
        ↓
Create JobStatusHistory
```

A valid JWT alone is insufficient.

---

# 19. Job Status State Machine

Do not allow arbitrary status editing.

Initial intended flow:

```text
ASSIGNED
    ↓
ON_THE_WAY
    ↓
IN_PROGRESS
    ↓
COMPLETED
```

Only valid transitions should be accepted.

Every transition must create a:

```text
JobStatusHistory
```

record.

Example:

```text
ASSIGNED → ON_THE_WAY
```

creates:

```text
JobStatusHistory
- fromStatus: ASSIGNED
- toStatus: ON_THE_WAY
- changedById: technicianId
- changedAt: timestamp
```

Invalid transitions must be rejected.

---

# 20. Payment & Receipt Calculation

Receipt totals must be calculated server-side.

Do not allow frontend calculations to become the source of truth.

Conceptually:

```text
Subtotal
=
Service Charge
+
Parts
+
Additional Charges
```

Then:

```text
Total
=
Subtotal
-
Discount
```

Then:

```text
Pending
=
Total
-
Paid Amount
```

Tip should be treated separately from the service total unless the business rules explicitly say otherwise.

The exact calculation must be centralized so frontend and backend do not produce conflicting totals.

---

# 21. Profile Photo Architecture

Profile photos are a user profile concern, not a separate business entity.

Database:

```text
User.profilePhotoUrl
```

MVP flow:

```text
Owner Registration
      ↓
Optional Photo
      ↓
Validate file
      ↓
Store locally / stub storage
      ↓
Save URL/path in User
```

Technician creation:

```text
Owner creates Technician
      ↓
Optional Photo
      ↓
Validate file
      ↓
Store locally / stub storage
      ↓
Save URL/path in User
```

Important:

```text
Database stores URL/path
NOT image binary
```

Future:

```text
Frontend
   ↓
Request presigned URL
   ↓
S3
   ↓
Save object URL/key
```

---

# 22. Development Phases

## Phase 0 — Project Setup

Dependencies:

```text
None
```

Build:

* Repository
* Express skeleton
* React/Vite skeleton
* Environment configuration

Definition of Done:

```text
Both apps run locally.
Backend exposes /health.
```

Difficulty:

```text
Easy
```

---

## Phase 1 — Database + Prisma

Build:

* Business
* User
* Customer
* Job
* Enums
* Prisma schema
* Migrations
* Seed script

Definition of Done:

```text
prisma migrate dev succeeds.
Seed script creates a business.
```

Learn before phase:

* Relational modeling
* Primary keys
* Foreign keys
* Constraints
* Indexes
* Relations
* Prisma basics
* Migrations

Difficulty:

```text
Easy–Medium
```

---

## Phase 2 — Authentication

Build:

* Owner registration
* Optional owner profile photo
* Login
* JWT access token
* JWT refresh token
* httpOnly cookies
* bcrypt
* Authentication middleware
* RBAC middleware

Endpoints:

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

Definition of Done:

```text
Owner can register.
Owner can optionally upload profile photo.
Owner can log in.
Protected route rejects unauthenticated requests.
Refresh flow works.
Logout invalidates/clears authentication appropriately.
RBAC middleware works.
```

Learn before phase:

* HTTP authentication
* JWT
* Access vs refresh tokens
* Cookies
* httpOnly
* bcrypt
* RBAC
* Authentication vs authorization

Difficulty:

```text
Medium
```

---

## Phase 3 — Customer Management

Build:

* Customer creation
* Customer listing
* Customer search
* Customer detail
* Customer update
* Tenant scoping
* Customer service history

Definition of Done:

```text
Owner can create/list/search customers.
Business A cannot see Business B's customers.
```

Difficulty:

```text
Easy–Medium
```

---

## Phase 4 — Technician Management

Build:

* Technician creation
* Technician listing
* Technician detail
* Technician update
* Technician login
* Technician profile photo
* Limited technician scope

Definition of Done:

```text
Owner can create technicians.
Technician can log in.
Technician has limited access.
Optional technician profile photo works.
```

Difficulty:

```text
Easy–Medium
```

---

## Phase 5 — Job Workflow

Build:

* Job creation
* Job assignment
* Job status state machine
* Status validation
* JobStatusHistory
* Ownership checks

Definition of Done:

```text
Full valid status transition works.
Invalid transitions are rejected.
Every transition creates history.
Technicians can only operate on permitted jobs.
```

Difficulty:

```text
Medium–Hard
```

Learn before phase:

* State machines
* Business rules
* Data integrity
* Concurrency considerations

---

## Phase 6 — Service Completion

Build:

* Work notes
* Problem found
* Work performed
* Parts
* Additional charges
* Notes
* Basic photos
* Before/after photo type
* Job completion

Definition of Done:

```text
Technician can complete a job and record everything needed for a receipt.
```

Difficulty:

```text
Medium
```

---

## Phase 7 — Payments + Receipt

Build:

* Manual payment
* Cash
* UPI
* Card
* Other
* Payment status
* Total calculation
* Paid amount
* Pending amount
* Computed receipt

Definition of Done:

```text
Total / paid / pending compute correctly.
Receipt view matches stored data.
```

Difficulty:

```text
Medium
```

Learn before phase:

* Transactional writes
* Data integrity
* Server-side calculations
* Avoiding inconsistent totals

---

## Phase 8 — Customer Confirmation, Signature, Review, Tip

Build:

* Public scoped job token
* Customer job page
* Completion confirmation
* Signature capture
* Review
* Optional tip
* Customer receipt access

Definition of Done:

```text
Customer link works without login.
Customer can only access the specific authorized job.
Customer can confirm.
Customer can sign.
Customer can review.
Customer can optionally tip.
```

Difficulty:

```text
Medium–Hard
```

Learn before phase:

* Token-based scoped authorization
* Resource-level authorization
* Preventing data leakage
* Public endpoint security

---

# MVP COMPLETE

MVP is complete when the full workflow works reliably end-to-end:

```text
Service Request
→ Job
→ Assignment
→ Technician Work
→ Parts
→ Charges
→ Photos
→ Completion
→ Customer Confirmation
→ Signature
→ Payment
→ Review
→ Tip
→ Receipt
→ History
```

And all of it respects:

```text
Authentication
+
RBAC
+
Resource Ownership
+
Tenant Isolation
```

---

# 23. V1 / Advanced Phases

## Phase 9 — Realtime Communication

Technology:

```text
Socket.IO
```

Build:

* Owner ↔ technician chat
* Persistent messages
* Realtime delivery

Difficulty:

```text
Hard
```

Learn:

* WebSocket concepts
* Socket authentication
* Rooms
* Realtime authorization

---

## Phase 10 — File Storage

Technology:

```text
S3 / Object Storage
```

Build:

* Real photo uploads
* Profile photo uploads
* Signature storage
* Presigned URLs

Difficulty:

```text
Medium
```

Learn:

* Object storage
* Presigned URL flow
* Upload security
* File validation

---

## Phase 11 — Redis

Use for:

* Refresh token/session-related storage if appropriate
* Caching
* Hot reads

Difficulty:

```text
Medium
```

Do not introduce Redis before the core PostgreSQL application is working correctly.

---

## Phase 12 — Background Jobs

Technology:

```text
BullMQ
```

Example:

```text
Reminder
Broadcast
Notification
```

Architecture:

```text
API
 ↓
Queue
 ↓
Worker
 ↓
Background processing
```

Difficulty:

```text
Hard
```

---

## Phase 13 — Testing

Build tests for:

* Authentication
* RBAC
* Tenant isolation
* Job state machine
* Payment calculation
* Customer token authorization
* Critical business flows

Technology can include:

```text
Jest
Supertest
```

Definition of Done:

```text
Core flows are covered by automated tests.
```

Difficulty:

```text
Medium
```

---

## Phase 14 — Docker / Deployment

Build:

* Docker configuration
* Docker Compose
* Backend container
* Frontend container
* PostgreSQL
* Environment configuration

Definition of Done:

```text
docker-compose up
```

runs the full stack.

Difficulty:

```text
Medium
```

---

## Phase 15 — Production Hardening

Build:

* Rate limiting
* Audit logs
* Structured logging
* Observability
* Health checks
* Better error monitoring
* Idempotency for payment webhooks
* Production security improvements

Definition of Done:

```text
Health checks work.
Logging exists.
Basic rate limits are implemented.
Critical production concerns are addressed.
```

Difficulty:

```text
Medium–Hard
```

---

# 24. What to Learn Before Each Phase

## Phase 1

Learn:

* Relational databases
* Tables
* Primary keys
* Foreign keys
* Constraints
* Indexes
* Relationships
* Prisma
* Migrations

## Phase 2

Learn:

* Authentication
* JWT
* Access tokens
* Refresh tokens
* Cookies
* httpOnly
* bcrypt
* RBAC

## Phase 5

Learn:

* State machines
* Allowed transitions
* Data integrity
* Concurrency

## Phase 7

Learn:

* Transactions
* Payment calculations
* Consistency
* Server-side calculations

## Phase 8

Learn:

* Token-based authorization
* Scoped access
* Public endpoint security
* IDOR prevention

## Phase 9

Learn:

* WebSockets
* Socket authentication
* Rooms
* Realtime authorization

## Phase 10

Learn:

* Object storage
* S3
* Presigned URLs
* File upload security

## Phase 12

Learn:

* Queues
* Workers
* Background jobs
* Retry mechanisms

---

# 25. Biggest Architectural Mistakes to Avoid

## 1. NEVER trust businessId from the client

Bad:

```text
req.body.businessId
```

Good:

```text
authenticatedUser.businessId
```

---

## 2. NEVER allow free editing of job status

Bad:

```text
PATCH /jobs/:id
{
  "status": "COMPLETED"
}
```

without validating the transition.

Good:

```text
Allowed transition table
+
JobStatusHistory
```

---

## 3. NEVER calculate receipt totals inconsistently

Do not have:

```text
Frontend calculation
+
Backend calculation
+
Receipt calculation
```

all using slightly different formulas.

Server-side calculation should be the source of truth.

---

## 4. Do not build advanced infrastructure too early

Do not jump to:

```text
Socket.IO
Redis
Razorpay
S3
BullMQ
```

before:

```text
REST
+
PostgreSQL
+
Authentication
+
Authorization
+
Core workflow
```

is solid.

---

## 5. Do not skip JobStatusHistory

You need an audit trail for:

```text
Who changed the job?
From what?
To what?
When?
```

---

## 6. Do not over-normalize the MVP

Avoid prematurely creating complex catalogs such as a global Part system.

Start simple.

Add complexity only when real requirements justify it.

---

## 7. Do not store images as PostgreSQL blobs

For:

* Job photos
* Profile photos
* Signatures

prefer:

```text
File/Object Storage
        ↓
URL / Object Key
        ↓
Database
```

---

## 8. Do not rely only on route-level authorization

Checking:

```text
requireRole("TECHNICIAN")
```

is not enough.

The service must also verify:

```text
tenant ownership
+
resource ownership
+
technician assignment
```

---

# 26. MVP → V1 → Production Roadmap

## MVP

```text
Authentication
RBAC
Multi-tenancy
Customers
Technicians
Jobs
Job state machine
Job history
Parts
Charges
Photos
Profile photos
Manual payments
Receipt
Customer confirmation
Signature
Review
Tip
```

All with strict tenant isolation.

---

## V1

```text
Socket.IO chat
Real file uploads
S3
Redis
Razorpay
Broadcast messaging architecture
SMS / WhatsApp-ready architecture
Better search/filtering
Notifications
```

---

## Production / Advanced

```text
BullMQ
Rate limiting
Audit logs
Structured logging
Observability
Payment webhook idempotency
CI/CD
Advanced caching
```

---

# 27. Progress Checklist

```text
[ ] Phase 0 — Project setup

[ ] Phase 1 — Database + Prisma

[ ] Phase 2 — Authentication
    [ ] Owner registration
    [ ] Optional owner profile photo
    [ ] Login
    [ ] Access JWT
    [ ] Refresh JWT
    [ ] httpOnly cookies
    [ ] bcrypt
    [ ] Authentication middleware
    [ ] RBAC middleware
    [ ] Logout

[ ] Phase 3 — Customer management
    [ ] CRUD
    [ ] Tenant scoping
    [ ] Customer history

[ ] Phase 4 — Technician management
    [ ] CRUD
    [ ] Technician authentication
    [ ] Limited scope
    [ ] Optional technician profile photo

[ ] Phase 5 — Job workflow
    [ ] Job creation
    [ ] Assignment
    [ ] Status state machine
    [ ] Status history
    [ ] Ownership checks

[ ] Phase 6 — Service completion
    [ ] Work notes
    [ ] Parts
    [ ] Charges
    [ ] Photos
    [ ] Completion

[ ] Phase 7 — Payments + receipt
    [ ] Manual payment
    [ ] Total calculation
    [ ] Paid calculation
    [ ] Pending calculation
    [ ] Receipt

[ ] Phase 8 — Customer-facing workflow
    [ ] Scoped job token
    [ ] Confirmation
    [ ] Signature
    [ ] Review
    [ ] Tip
    [ ] Customer receipt

MVP COMPLETE
    [ ] Full end-to-end workflow works reliably
    [ ] Tenant isolation verified
    [ ] Authorization verified
    [ ] Core business rules verified

[ ] Phase 9 — Realtime chat

[ ] Phase 10 — S3 / file storage

[ ] Phase 11 — Redis

[ ] Phase 12 — BullMQ

[ ] Phase 13 — Testing

[ ] Phase 14 — Docker / deployment

[ ] Phase 15 — Production hardening
```

---

# 28. Instructions for Antigravity

Whenever a new development chat/session starts:

## Step 1 — Read this file

Read:

```text
roadmap.md
```

before making architectural decisions.

---

## Step 2 — Inspect the actual repository

Do not assume the roadmap represents the current implementation.

Inspect:

```text
BACKEND/
FRONTEND/
prisma/
src/
routes/
controllers/
services/
middleware/
validators/
package.json
.env.example
migrations
tests
```

as applicable to the current phase.

---

## Step 3 — Determine actual project state

Identify:

```text
What is implemented?
What is partially implemented?
What is missing?
What is broken?
What has not been tested?
```

Do not mark a feature complete merely because a file exists.

---

## Step 4 — Cross-check against roadmap

Compare:

```text
ROADMAP
    vs
ACTUAL CODE
```

Identify gaps.

Example:

```text
Roadmap:
Authentication includes access + refresh JWT,
httpOnly cookies and logout.

Repository:
Only one JWT in Authorization header.

Conclusion:
Authentication is NOT fully complete.
```

Do not silently declare the phase complete.

---

## Step 5 — Follow the current phase

Do not jump randomly to future technologies.

For example:

If Phase 2 authentication is incomplete, do not start:

```text
Redis
Socket.IO
S3
BullMQ
Razorpay
```

Finish the current logical phase first.

---

## Step 6 — Preserve architecture

Follow these boundaries:

```text
Route
 ↓
Middleware
 ↓
Controller
 ↓
Service
 ↓
Prisma
 ↓
PostgreSQL
```

Controllers should not become database/business-logic containers.

Services own business rules and Prisma access.

---

## Step 7 — Protect tenant isolation

For every new feature ask:

```text
Can User A access User B's data?
```

Also ask:

```text
Can Business A access Business B's data?
```

Never trust:

```text
businessId
```

from the client.

---

## Step 8 — Verify before changing

Before implementing a feature:

1. Inspect existing code.
2. Explain what already exists.
3. Identify the smallest missing piece.
4. Implement only what is necessary.
5. Test it.
6. Review security and tenant isolation.
7. Update project state/documentation if appropriate.

---

## Step 9 — Do not rewrite working code unnecessarily

If existing code is correct:

```text
Keep it.
```

Do not refactor everything just because a new chat/session started.

Only change existing architecture when there is a real reason.

---

## Step 10 — Keep the MVP simple

Do not introduce V1/production infrastructure early.

Prefer:

```text
Correct
Simple
Testable
Understandable
Secure
```

over:

```text
Complex
Prematurely scalable
Over-engineered
```

---

# 29. Definition of a Real MVP

ServicePilot is not considered MVP-complete because:

```text
Frontend screens exist
```

or:

```text
API endpoints exist
```

or:

```text
Database models exist
```

MVP is complete only when the complete workflow works with real data:

```text
Business
 ↓
Owner
 ↓
Customer
 ↓
Job
 ↓
Technician
 ↓
Work
 ↓
Parts
 ↓
Charges
 ↓
Photos
 ↓
Completion
 ↓
Customer confirmation
 ↓
Signature
 ↓
Payment
 ↓
Review
 ↓
Tip
 ↓
Receipt
 ↓
History
```

while maintaining:

```text
Authentication
+
RBAC
+
Tenant isolation
+
Resource ownership
+
Data integrity
```

---

# 30. Final Engineering Principle

The project should always be evaluated using three sources of truth:

```text
1. roadmap.md
   ↓
What we intend to build.

2. Repository/code
   ↓
What has actually been built.

3. Tests
   ↓
What has been proven to work.
```

Never confuse these three.

A feature is truly complete only when:

```text
Architecture says it should exist
        +
Code implements it
        +
Tests verify it
```

That is the standard for ServicePilot.
