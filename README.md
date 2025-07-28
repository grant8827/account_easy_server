# Account Easy - Backend API

A comprehensive multi-business financial staffing webapp backend built with Express.js and MongoDB, featuring Jamaica tax system integration.

## Features

- **Multi-Business Management**: Support for multiple business entities
- **Employee Management**: Complete employee lifecycle management
- **Payroll Processing**: Jamaica tax-compliant payroll with PAYE, NIS, Education Tax calculations
- **Transaction Tracking**: Financial transaction management with GCT calculations
- **Jamaica Tax Integration**: Annual tax filing, monthly returns, and compliance reporting
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Security**: Comprehensive security middleware with rate limiting, CORS, and helmet

## Project Structure

```
server/
├── index.js                 # Main server file
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables
├── middleware/
│   ├── auth.js              # Authentication & authorization middleware
│   └── validation.js        # Input validation rules
├── models/
│   ├── User.js              # User model with roles
│   ├── Business.js          # Business entity model
│   ├── Employee.js          # Employee management model
│   ├── Transaction.js       # Financial transaction model
│   └── Payroll.js           # Payroll processing model
└── routes/
    ├── auth.js              # Authentication routes
    ├── businesses.js        # Business management routes
    ├── employees.js         # Employee management routes
    ├── transactions.js      # Transaction routes
    ├── payroll.js           # Payroll processing routes
    └── tax.js               # Jamaica tax system routes
```

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Copy `.env` file and update with your settings
   - Set strong JWT secrets for production
   - Configure MongoDB connection string

4. Start MongoDB service on your machine

## Development

Start the development server:
```bash
npm run dev
```

Start the production server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Business Management
- `GET /api/businesses` - Get user's businesses
- `POST /api/businesses` - Create new business
- `GET /api/businesses/:id` - Get business details
- `PUT /api/businesses/:id` - Update business
- `DELETE /api/businesses/:id` - Delete business
- `GET /api/businesses/:id/dashboard` - Get business dashboard data

### Employee Management
- `GET /api/employees` - Get employees (by business)
- `POST /api/employees` - Add new employee
- `GET /api/employees/:id` - Get employee details
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `POST /api/employees/:id/leave` - Request leave
- `PUT /api/employees/:id/leave/:leaveId` - Update leave request
- `POST /api/employees/:id/terminate` - Terminate employee

### Transaction Management
- `GET /api/transactions` - Get transactions (by business)
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/:id` - Get transaction details
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction
- `POST /api/transactions/reconcile` - Reconcile transactions
- `GET /api/transactions/reports` - Generate transaction reports

### Payroll Processing
- `GET /api/payroll` - Get payroll records (by business)
- `POST /api/payroll` - Create payroll entry
- `POST /api/payroll/bulk` - Bulk create payroll entries
- `GET /api/payroll/:id` - Get payroll details
- `PUT /api/payroll/:id` - Update payroll
- `DELETE /api/payroll/:id` - Delete payroll
- `POST /api/payroll/process` - Process payroll for period
- `GET /api/payroll/reports` - Generate payroll reports

### Jamaica Tax System
- `GET /api/tax/annual-report/:year` - Generate annual tax report
- `GET /api/tax/monthly-return/:year/:month` - Generate monthly tax return
- `POST /api/tax/calculate-paye` - Calculate PAYE tax
- `POST /api/tax/calculate-nis` - Calculate NIS contributions
- `POST /api/tax/calculate-education` - Calculate Education Tax
- `GET /api/tax/compliance-check` - Check tax compliance status

## Jamaica Tax System Features

### Tax Calculations
- **PAYE (Pay As You Earn)**: Progressive tax brackets
- **NIS (National Insurance Scheme)**: Employee and employer contributions
- **Education Tax**: 2.5% on annual income over threshold
- **HEART Trust**: Skills development levy
- **GCT (General Consumption Tax)**: 15% on applicable transactions

### Tax Compliance
- Annual tax report generation
- Monthly tax return processing
- Compliance status checking
- Tax payment tracking

### Tax Rates (2024)
- PAYE: Progressive rates from 0% to 30%
- NIS: 3% employee, 3% employer (max income: JMD 2,000,000)
- Education Tax: 2.5% (income over JMD 3,000,000)
- HEART Trust: 3% of payroll
- GCT: 15% standard rate

## Security Features

- JWT authentication with refresh tokens
- Role-based access control (Admin, Manager, Employee)
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Input validation and sanitization
- CORS configuration
- Security headers with Helmet
- Environment variable protection

## Database Models

### User Model
- Personal information and authentication
- Role-based access (admin, manager, employee)
- Business associations
- Account status management

### Business Model
- Company information and settings
- Jamaica parish and tax registration
- Employee assignments
- Financial settings

### Employee Model
- Personal and employment details
- Jamaica tax information (TRN, NIS)
- Leave management
- Payroll associations

### Transaction Model
- Financial transaction tracking
- GCT calculations
- Reconciliation status
- Audit trail

### Payroll Model
- Comprehensive payroll processing
- Jamaica tax calculations
- Deduction management
- Payment tracking

## Environment Variables

Key environment variables to configure:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/account_easy
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please contact the development team.
