//import mongoose from './model/db.js';
import express from 'express';
import { router as roteador } from './router/routerAccounts.js';

const port = 3000;
const app = express();

app.use(express.json());



app.use('/', roteador);

app.listen(port, () => {
  console.log('App aguardando conexões!');
});


