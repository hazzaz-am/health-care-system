import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import config from './config';
import { uptime } from 'process';
import { timeStamp } from 'console';
import router from './app/routes';
import cookieParser from 'cookie-parser';

const app: Application = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

//parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.get('/', (req: Request, res: Response) => {
    res.send({
        message: "Server is running..",
        environment: config.node_env,
        uptime: process.uptime().toFixed(2) + " sec",
        timeStamp: new Date().toISOString()
    })
});

/**
 * Routes
 */
app.use("/api/v1", router)


/**
 * Global Error Handler
 */
app.use(globalErrorHandler);

/**
 * Handle Route Not Found Errors
 */
app.use(notFound);

export default app;