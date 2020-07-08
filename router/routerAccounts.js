import express from 'express';
import { modelAccount } from '../model/modelAccounts.js'

export const router = express.Router();

//funcao de Midleware para valida conta
const validarConta = async (request, response, next) => {
  const info = request.params;

  try {
    const accountfindOne = await modelAccount.findOne({ agencia: info.agencia, conta: { $eq: info.conta } }).exec();
    if (!accountfindOne) throw new Error('Essa conta não existe!!');

    request.local = accountfindOne;
    next();

  } catch (erro) {
    response.status(500).send(`${erro}`);
    console.log(`${erro}`);

  }
}

//Midleware para validar as operacoes de deposito e saque
const midleWareValidarOperacao = async (req, resp, next) => {
  const { agencia, conta, value } = req.body;

  try {
    const account = await modelAccount.findOne({ agencia, conta: { $eq: conta } }, '_id balance').exec();

    if (!account) throw new Error('Essa conta não existe!!');
    if ((value + account.balance < 0)) throw new Error('Saldo Insuficiente!!');

    req.id = account._id;
    next();

  } catch (error) {
    resp.status(500).send('' + error);
    console.log('Erro ao validar conta: ' + error);
  }
}

// função de Midleware para mostrar logs das conexões
const logs = (req, resp, next) => {
  const { headers, url, method } = req;
  console.log(
    ` \nconexão info: host: ${headers.host} | url: ${url} | method: ${method}`);
  next();
}

//Registrando os interceptadores das conexões para as urls:
router.patch('/account/deposit', midleWareValidarOperacao);
router.patch('/account/saque', midleWareValidarOperacao);
router.use(logs);


//Registrar deposito em conta
router.patch('/account/deposit', async (req, resp) => {
  const _id = req.id;
  const { value } = req.body;

  try {
    const query = { _id };
    const update = { $inc: { balance: value } };
    const option = { new: true, runValidators: true };

    const account = await modelAccount.findOneAndUpdate(query, update, option);

    if (!account) throw new Error('Conta não atualizada');

    console.log('Saldo Alterado: ' + account)
    resp.send('Novo Balance: ' + account.balance);

  } catch (error) {
    resp.status(500).send(error);
  }
});

//Registrar saque em conta
router.patch('/account/saque', async (request, resp) => {
  const { value } = request.body;
  const taxa = 1;

  const query = { _id: request.id };
  const update = { $inc: { balance: value - taxa } };
  const option = { new: true, runValidators: true };

  try {
    const account = await modelAccount.findOneAndUpdate(query, update, option);
    if (!account) throw new Error('Conta não atualizada');

    console.log('Saldo Alterado: ' + account)
    resp.send('Novo Balance: ' + account.balance);

  } catch (error) {
    resp.status(500).send(error);
  }

});

//Consultar o saldo de determinada conta
router.get('/account/saldo/:agencia/:conta', validarConta, (request, response) => {
  const { balance } = request.local;
  console.log('\nquantidade de saldo: ' + request.local);

  response.send(`Saldo da conta: ${balance}`);

});

//Deletar determinada conta e informar quantas contas  naquela agencia da conta deletada
router.delete('/account/delete/:agencia/:conta', validarConta, async (request, response) => {
  const { _id, agencia } = request.local;

  try {
    //Deletando conta
    const contaDeletada = await modelAccount.findOneAndDelete(_id);
    console.log('Conta Deletada: ' + contaDeletada);

    //Se ocorrer algum erro
    if (!contaDeletada) throw new Error('Conta Não deletada');

    //Pesquisando quantidade de contas de determinada agencia
    const filtro = { agencia: { $eq: agencia } };
    const totalContas = await modelAccount.countDocuments(filtro).exec();

    response.send(`Total contas que restam: ${totalContas}`);

  } catch (error) {
    response.status(500).send('Erro: ' + error);
    console.log('Erro ao deletar conta: ' + error);
  }

});

//Fazer tranferencia entre contas 
router.put('/account/transferencia', async (request, response) => {
  const { contaOrigem, contaDestino, valor } = request.body;

  let retirada = 0;
  const tarifa = 8;

  try {
    //consultando as duas contas no banco 
    const accountOrigem = await modelAccount.findOne({ conta: { $eq: contaOrigem } }).exec();
    const accountDestino = await modelAccount.findOne({ conta: { $eq: contaDestino } }).exec();

    //validar se as  duas contas são validas
    if (!(accountOrigem != null) || !(accountDestino != null)) throw new Error('Numero da conta INVÁLIDO');

    console.log('conta origem: ' + accountOrigem);
    console.log('conta Destino: ' + accountDestino);

    //Validar se as contas são da mesma agencia
    //Se forem da mesma agencia
    if (accountOrigem.agencia === accountDestino.agencia) {

      //Fazer atualizacao  de retirada na conta que vai tranferir o dinheiro
      let retirada = valor * -1;
      //Validar se a conta tem saldo suficiente para fazer transferencia de dinheiro
      if ((retirada + accountOrigem.balance < 0)) throw new Error('Saldo Insuficiente!!');

      let query = { agencia: accountOrigem.agencia, conta: accountOrigem.conta };
      let update = { $inc: { balance: retirada } };
      let option = { new: true };
      await modelAccount.findOneAndUpdate(query, update, option);
    }
    else {
      //Se as agencias forem diferentes debitar R$ 8,00 da conta origem
      //Fazer atualizacao  de retirada na conta que vai tranferir o dinheiro
      let retirada = (8 + valor) * -1;

      //Validar se a conta tem saldo suficiente para fazer transferencia de dinheiro
      if ((retirada + accountOrigem.balance < 0)) throw new Error('Saldo Insuficiente!!');

      let query = { agencia: accountOrigem.agencia, conta: accountOrigem.conta };
      let update = { $inc: { balance: retirada } };
      let option = { new: true };
      await modelAccount.findOneAndUpdate(query, update, option);
    }

    //Fazer atualizacao de novo saldo da conta que vai receber o dinheiro
    let query = { agencia: accountDestino.agencia, conta: accountDestino.conta };
    let update = { $inc: { balance: valor } };
    let option = { new: true };
    await modelAccount.findOneAndUpdate(query, update, option);

    //Retornar para o cliente o novo saldo da conta origem
    const conta = await modelAccount.findOne({ conta: { $eq: contaOrigem } }).exec();
    response.send(`Novo saldo: ${conta.balance}`);

  } catch (error) {//msg de erro
    response.status(500).send(`${error}`);
    console.log('Erro encontrado: ' + error);

  }

});

//#Media dos saldos dos clientes de determinada agencia:
router.get('/account/media_saldos/:agencia', async (request, response) => {
  const agencia = Number(request.params.agencia);

  try {
    const arrayInfo = await modelAccount
      .aggregate([
        { $match: { agencia } },
        {
          $group: {
            _id: "$agencia",
            media_balance: { $avg: "$balance" }
          }
        }
      ]);

    //Mostra um erro caso o resultado seja um array sem elementos
    if (arrayInfo.length == 0) throw new Error('Agencia invalida!');
    const media = arrayInfo[0].media_balance;

    //Mostra a media para o cliente
    response.send(`Media dos saldos dos clientes: ${media}`);

  } catch (error) {
    response.status(500).send(`Aconteceu algum erro: ${error}`);
    console.log('Erro encontrado: ' + error);
  }
});

//#Rota para mostrar certa quantidade de clientes com menores saldos
router.get('/account/cli_menor_saldos/:qnt', async (request, response) => {
  const quant = Number(request.params.qnt);

  try {
    const accounts = await modelAccount.aggregate([
      { $project: { name: 1, balance: 1, conta: 1, agencia: 1, _id: 0 } }, //mostrar todos os campos menos o _id
      { $sort: { balance: 1 } }, //para ornenar em ordem crescente de saldo
      { $limit: quant } //Para limitar o que vai ser buscado
    ]);

    if (accounts.length > 0) response.send(accounts);

  } catch (error) {
    response.send(`Algun erro foi encontrado: ${error}`);
    console.log('Erro encontrado: ' + error);
  }
});


//#Rota para mostrar os clientes que tem o maior saldo do banco:
router.get('/account/cli_maior_saldos/:qnt', async (request, response) => {
  const quant = Number(request.params.qnt);

  try {
    const accounts = await modelAccount.aggregate([
      { $project: { name: 1, balance: 1, conta: 1, agencia: 1, _id: 0 } }, //mostrar todos os campos menos o _id
      { $sort: { balance: -1, name: 1 } }, //para ordenar em ordem decrescente de 'balance' e crescente em 'name'
      { $limit: quant } //Para limitar o que vai ser buscado
    ]);

    //mostrar a  lista de clientes
    if (accounts.length > 0) response.send(accounts);

  } catch (error) {
    response.send(`Algun erro foi encontrado: ${error}`);
    console.log('Erro encontrado: ' + error);
  }
});


//Rota para mostrar os clientes mais ricos de cada agencia , os clientes da agencia Private
router.get('/account/agenciaPrivate', async (request, response) => {

  try {
    //Separando os maiores 'balances' por agencia do banco
    const aggrResult = await modelAccount.aggregate([
      {
        $group: {
          _id: '$agencia',
          maiorSaldo: { $max: "$balance" }
        }
      }
    ]);

    //Salvando todos os maiores saldos em um array
    const saldos = [];
    for (let item of aggrResult) {
      saldos.push(item.maiorSaldo);
    }

    //Fazendo uma consulta para retornar todos os clientes com maiores saldos
    //de todas as agencias
    const clientes = await modelAccount.aggregate([
      { $project: { name: 1, balance: 1, conta: 1, agencia: 1, _id: 0 } },
      { $match: { balance: { $in: saldos } } }
    ]);

    response.send(clientes);

  } catch (error) {
    response.status(500).send(`Ocorreu algum erro: ${error}`);
    console.log(`Erro ocorrido: ${error}`);
  }
});




/* async function getCount() {
    const myconta = await modelAccount.findOne({conta: {$eq: conta } }).exec();
    //const myconta = await modelAccount.find({conta: 1021, agencia: {$eq: '10' } });
    return myconta;
  } */

/*  modelAccount.find({conta: {$eq: 1021 } }, 'conta agencia name -_id', function (err, docs) {
                console.log('calback: ' + docs);
   next()

 }); */

/* const myconta = await modelAccount.findById(id, ' -_id agencia conta');
   console.log('conta: ' + myconta);
   next(); */

//const accounts = await modelAccount.find({$or: [{conta: contaOrigem }, {conta: contaDestino }] });

