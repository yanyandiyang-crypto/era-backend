# ERA Backend API

Emergency Response Assistance - Backend API built with Fastify and Prisma.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy example environment file
copy .env.example .env

# Edit .env and fill in your values:
# - DATABASE_URL: Your PostgreSQL connection string
# - JWT_ACCESS_SECRET: Random string (min 32 chars)
# - JWT_REFRESH_SECRET: Random string (min 32 chars)
```

### 3. Set Up Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with initial data
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```

Server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:seed` - Seed database
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Default Login Credentials

After seeding the database:

**Admin:**
- Email: `admin@era.com`
- Password: `Admin@123`

**Personnel:**
- Email: `responder1@era.com`
- Password: `Personnel@123`

⚠️ **IMPORTANT:** Change these credentials immediately in production!

## API Endpoints

- `GET /health` - Health check endpoint

More endpoints will be added as features are implemented.

## Project Structure

```
src/
├── config/          # Configuration files
├── core/            # Core utilities & middleware
│   ├── errors/      # Custom error classes
│   ├── middleware/  # Middleware functions
│   └── utils/       # Utility functions
├── features/        # Feature modules (to be added)
├── plugins/         # Fastify plugins
├── types/           # TypeScript types
├── app.ts           # Fastify app setup
└── server.ts        # Server entry point
```

## Next Steps

Follow the [WORK_PLAN.md](../WORK_PLAN.md) to implement features phase by phase.
