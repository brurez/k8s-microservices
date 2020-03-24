const express = require("express");
const bodyParser = require("body-parser");
const keys = require("./keys");
const cors = require("cors");

// Express app setup
const app = express();
app.use(cors());

app.use(bodyParser.json());
// Postgres client setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  port: keys.pgPort
});

pgClient.on("error", () => console.log("Lost PG connection"));

pgClient
  .query("CREATE TABLE IF NOT EXISTS values (number INT)")
  .catch(err => console.log(err));
// Redis client setup
const redis = require("redis");

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// RabbitMQ setup
const amqp = require('amqplib/callback_api');


// Express route handlers
app.get("/", (req, res) => {
  res.send("Hi");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    res.send(values);
  });
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 50) {
    return res.status(422).send("Index too high");
  }

  redisClient.hset("values", index, "Nothing yet!");
  redisPublisher.publish("insert", index);
  pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({ working: true });
});

app.post("/prime-numbers", async (req, res) => {
  const msg = req.body.index;

  amqp.connect(keys.broker, function(error0, connection) {
    if (error0) {
      throw error0;
    }
    connection.createChannel(function(error1, channel) {
      if (error1) {
        throw error1;
      }
      const queue = 'primes';

      channel.assertQueue(queue, {
        durable: true
      });
      channel.sendToQueue(queue, Buffer.from(msg), {
        persistent: true
      });
      console.log(" [x] Sent %s", msg);
    });
  });
  res.send('');
});

const connectToBroker = () => {
  amqp.connect(keys.broker, function (error0, connection) {
    if (error0) {
      setTimeout(connectToBroker, 1000);
      return;
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1;
      }

      channel.assertExchange('exchange', 'fanout', {
        durable: false
      });

      channel.assertQueue('', {
        exclusive: true
      }, function (error2, q) {
        if (error2) {
          throw error2;
        }
        console.log(" [*] Subscription ON", q.queue);
        channel.bindQueue(q.queue, 'exchange', '');
        channel.consume(q.queue, function (msg) {
          if (msg.content) {
            console.log("Prime result received [x] %s", msg.content.toString());
          }
        }, {
          noAck: true
        });
      });
    });
  });
};

connectToBroker();

app.listen(5000, err => {
  console.log("Listening");
});
