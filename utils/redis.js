import redis from 'redis';
import { promisify } from 'util';

/**
 * A redis connection class.
 */
class RedisClient {
  constructor() {
    /**
     * The class constructor...
     */
    this.client = redis.createClient();

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setExAsync = promisify(this.client.setex).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);

    this.client.on('connect', () => {
      console.error('The Redis client is connected...');
    });

    this.client.on('error', () => {
      console.error('There has been an error connecting to Redis...');
    });
  }

  isAlive() {
    /**
     * A method that checks the life of a connection.
     * @return true if the connection is alive, false otherwise.
     */
    return this.client.connected;
  }

  async get(key) {
    /**
     * A method that gets a value of a key from redis.
     * @key The lookup key.
     */
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (error) {
      console.error(`Error: Failed to get the value for key: ${key}`);
    }
    return null;
  }

  async set(key, value, duration) {
    /**
     * A method that sets a value to a key in redis.
     * @key The key to set the value to.
     * @value The value to be set.
     * @duration The expiration duration.
     */
    try {
      this.setExAsync(key, duration, value);
    } catch (error) {
      console.error(`Error: Failed to set the value for key: ${key}`);
    }
  }

  async del(key) {
    /**
     * A method that removes that value for the key in redis.
     * @key The key to remove the value to.
     */
    try {
      this.delAsync(key);
    } catch (error) {
      console.error(`Error: Failed to delete the value for key: ${key}`);
    }
  }
}

/**
 * Exporting an instance...
 */
const redisClient = new RedisClient();
export default redisClient;
