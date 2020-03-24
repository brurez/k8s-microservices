const keys = require("./keys");

const amqp = require('amqplib/callback_api');

const primes = new Map();

function isPrime(num) {
  const sqrtnum = Math.floor(Math.sqrt(num));
  let prime = num !== 1;
  for (let i = 2; i < sqrtnum + 1; i++) {
    if (num % i === 0) {
      prime = false;
      break;
    }
  }
  return prime;
}

const connectToBroker = () =>
  amqp.connect(keys.broker, function (error0, connection) {
    if (error0) {
      setTimeout(connectToBroker, 1000);
      return;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      const queue = 'primes';

      channel.assertQueue(queue, {
        durable: true,
      });

      channel.prefetch(1);

      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);

      channel.consume(queue, function (msg) {
        const index = msg.content.toString();
        let msg2;
        console.log(" [x] Received %s", index);

        if (!primes.get(index)) {
          const isPrimeNumber = isPrime(index);
          primes.set(index, isPrimeNumber);
          msg2 = `{number: ${index}, isPrime: ${isPrimeNumber}}`;
        } else {
          msg2 = `{number: ${index}, isPrime: ${primes.get(index)}}`;
        }

        channel.ack(msg);

        channel.assertExchange('exchange', 'fanout', {
          durable: false
        });
        channel.publish('exchange', '', Buffer.from(msg2));
        console.log(" [x] Published prime result %s", msg2);
      }, {
        noAck: false,
      });
    });
  });

connectToBroker();
