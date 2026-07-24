process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://127.0.0.1:27017/museumBotTest";
process.env.JWT_SECRET = "testsecretkey123";

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");
const { server } = require("../server");

let testPort;
let baseUrl;

test.before(async () => {
  // Wait for the DB connection to establish
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once("open", resolve);
    });
  }

  // Clear test DB
  await mongoose.connection.db.dropDatabase();

  // Start listener on a random port
  await new Promise((resolve) => {
    server.listen(0, () => {
      testPort = server.address().port;
      baseUrl = `http://127.0.0.1:${testPort}`;
      console.log(`🧪 Test server booted on ${baseUrl}`);
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  console.log("🧪 Test server and DB connections closed.");
});

test("Backend API Integration Tests", async (t) => {
  let userToken;
  const testEmail = `test_${Date.now()}@test.com`;
  const testPassword = "securePassword123";

  await t.test("POST /register - should register a new admin user", async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Admin",
        email: testEmail,
        password: testPassword
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.ok(body.token);
    assert.strictEqual(body.email, testEmail);
  });

  await t.test("POST /login - should authenticate the user and return JWT", async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    userToken = body.token;
  });

  await t.test("GET /api/bookings/all - should block request without authorization token", async () => {
    const res = await fetch(`${baseUrl}/api/bookings/all`);
    assert.strictEqual(res.status, 403);
  });

  await t.test("GET /api/bookings/all - should allow request with a valid JWT token", async () => {
    const res = await fetch(`${baseUrl}/api/bookings/all`, {
      headers: {
        Authorization: userToken
      }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
  });
});
