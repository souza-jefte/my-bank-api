import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
mongoose.Promise = global.Promise;

(async () => {
  try {
    await mongoose.connect(process.env.URL_BANCO, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
      useFindAndModify: false
    });
    console.log('my-bank-api conectado ao MongoDB');

  } catch (error) {
    console.log('Erro ao conectar no MongoDB');
  }

})()

export default mongoose;
