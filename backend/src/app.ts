import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tasksRoutes from './routes/tasks.routes';
import calendarRoutes from './routes/calendar.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();

app.use(cors()); // ouvert pour le dev local (Expo Web tourne sur un autre port)
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notification-tokens', notificationsRoutes);

// Gestion d'erreur globale
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
);

export default app;
