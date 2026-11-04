import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js'
import expenseRoutes from './routes/expense.routes.js'

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

export default app;
