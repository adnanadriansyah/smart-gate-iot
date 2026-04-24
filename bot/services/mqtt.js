const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://broker.hivemq.com');

client.on('connect', () => {
  console.log("✅ MQTT Connected");
});

module.exports = {
  publish: (topic, message) => {
    client.publish(topic, message);
  }
};
