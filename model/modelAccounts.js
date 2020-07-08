import mongoose from './db.js';

const account = {
  agencia: { type: Number, required: true },
  conta: { type: Number, required: true, min: 0 },
  name: { type: String, required: true },
  balance: {
    type: Number, required: true,
    validate(balance) {
      if (balance < 0) throw new Error('Balance não pode ser Negativo');
    }
  }
}

const accontSchema = mongoose.Schema(account);

export const modelAccount = mongoose.model('accounts', accontSchema, 'accounts');