# 🔄 Reset Database and Reseed - Lapu-Lapu City Focus

## Quick Reset & Reseed

Run these commands in the `backend` folder:

```bash
# Stop the backend server first (Ctrl+C)

# Reset database (removes all data and recreates tables)
npx prisma migrate reset --force

# This will automatically:
# 1. Drop the database
# 2. Create a new database
# 3. Run all migrations
# 4. Run the seed file with Lapu-Lapu City data
# 5. Create 3 barangays with 14 total emergency contacts
```

## Alternative: Manual Steps

If you prefer step-by-step:

```bash
# 1. Reset migrations
npx prisma migrate reset

# 2. Generate Prisma Client
npx prisma generate

# 3. Run seed
npx prisma db seed
```

## Verify Data

After seeding, check the data:

```bash
# Open Prisma Studio to view data
npx prisma studio
```

## New Seed Data - Lapu-Lapu City, Mactan Island

### Barangays (3) with Emergency Contacts

- ✅ **Barangay Basak** (Main focus area)
  - Near Gaisano Grand Mall & Mactan Airport
  - **5 Emergency Contacts**: Barangay Hall, 911, Police, Fire, Health
  - Coordinates: 10.3120°N, 123.9600°E
  - Operating Hours: Mon-Fri 8AM-5PM | Emergency 24/7

- ✅ **Barangay Maribago** (Tourist Zone)
  - Pacific Mall, Shangri-La, JPark Resort area
  - **4 Emergency Contacts**: Barangay Hall, 911, Tourist Police, Fire
  - Coordinates: 10.3050°N, 123.9750°E
  - Operating Hours: Mon-Fri 8AM-5PM | 24/7 Tourist Assistance

- ✅ **Barangay Pusok** (Urban Residential)
  - Mactan Circumferential Road, near MEPZ
  - **5 Emergency Contacts**: Barangay Hall, 911, Police, Fire, Health
  - Coordinates: 10.3200°N, 123.9500°E
  - Operating Hours: Mon-Fri 7:30AM-5:30PM | Emergency 24/7

### Incidents (8)
1. **House Fire in Basak** - CRITICAL, REPORTED
2. **Elderly Patient - Chest Pain** - HIGH, DISPATCHED
3. **Motorcycle Collision** - MEDIUM, IN_PROGRESS
4. **Child Trapped in Drainage** - HIGH, REPORTED
5. **Robbery at Sari-Sari Store** - MEDIUM, RESOLVED
6. **Grass Fire Near Resort** - LOW, DISPATCHED
7. **Worker Fall at Construction Site** - CRITICAL, IN_PROGRESS
8. **Coastal Flooding** - HIGH, REPORTED (FLOOD type)

### Personnel (2)
- **Ricardo Mendoza** - Responder (responder1@era.com)
- **Maria Villanueva** - Medic (medic1@era.com)

### Login Credentials
- **Admin**: admin@era.com / Admin@123
- **Personnel**: responder1@era.com / Personnel@123

## After Reset

1. **Backend will auto-restart** after migration
2. **Map will center** on Basak, Lapu-Lapu City (10.3120°N, 123.9600°E)
3. **7 incidents visible** on map (1 hidden - RESOLVED)
4. **Test the verify workflow** with PENDING_VERIFICATION incidents

## Notes

- All coordinates are real Lapu-Lapu City locations
- Incident scenarios are realistic for the area
- Map zoom level set to 14 for better detail
- RESOLVED incidents automatically hidden from map
