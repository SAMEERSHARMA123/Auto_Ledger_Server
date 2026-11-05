import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js'
import expenseRoutes from './routes/expense.routes.js'
import debtRoutes from './routes/debt.routes.js'; // Nayi line add karein
import aiRoutes from './routes/ai.routes.js'; // Add this
import analyticsRoutes from './routes/analytics.routes.js';

const app = express();

app.use(cors({
    origin:'http://localhost:3000',
    credentials:true
})); 

app.use(express.json());

app.use(cookieParser());

app.get('/health',(req,res)=>{
    res.status(200).json({status:'API is running successfully'});
});

app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes); // Add this line
app.use('/api/debts', debtRoutes); // Nayi line add karein
app.use('/api/ai', aiRoutes); // Add this
app.use('/api/analytics', analyticsRoutes);

export default app;
