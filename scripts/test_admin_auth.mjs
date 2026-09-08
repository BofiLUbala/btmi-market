const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'bofibendedji@gmail.com';
const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

if (!adminPassword) {
  console.log('[INFO] SUPER_ADMIN_PASSWORD environment variable is not set.');
  console.log('[INFO] Usage: SUPER_ADMIN_PASSWORD="<password>" node scripts/test_admin_auth.mjs');
  console.log('\n--- 1. Testing unknown email (should return 401) ---');
  const resUnknown = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "unknown-admin@example.com", password: "InvalidPassword123!" })
  });
  console.log("Unknown email Status:", resUnknown.status);
  const dataUnknown = await resUnknown.json();
  console.log("Unknown email Response:", JSON.stringify(dataUnknown, null, 2));

  console.log("\n--- 2. Testing wrong password for " + adminEmail + " (should return 401) ---");
  const resWrong = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: "IncorrectPassword123!" })
  });
  console.log("Wrong password Status:", resWrong.status);
  const dataWrong = await resWrong.json();
  console.log("Wrong password Response:", JSON.stringify(dataWrong, null, 2));
  process.exit(0);
}

async function test() {
  console.log(`--- 1. Testing Admin Login for ${adminEmail} ---`);
  const res1 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  console.log("Login Status:", res1.status);
  const data1 = await res1.json();
  console.log("Login Full Response:", JSON.stringify({ ...data1, data: data1?.data ? { ...data1.data, access_token: data1.data.access_token ? '[REDACTED_TOKEN]' : undefined, refresh_token: data1.data.refresh_token ? '[REDACTED_TOKEN]' : undefined } : undefined }, null, 2));

  const token = data1.data?.access_token || data1.access_token;
  if (token) {
    const meRes = await fetch("http://localhost:8080/api/v1/admin/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    console.log("Admin /me Status:", meRes.status);
    const meData = await meRes.json();
    console.log("Admin /me Data:", JSON.stringify(meData, null, 2));
  }

  console.log("\n--- 2. Testing wrong password ---");
  const res3 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: "WrongPassword999!" })
  });
  console.log("Login (wrong pass) Status:", res3.status);
  const data3 = await res3.json();
  console.log("Login Error:", data3);

  console.log("\n--- 3. Testing unknown email ---");
  const res4 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@tbk.market", password: adminPassword })
  });
  console.log("Login (unknown email) Status:", res4.status);
  const data4 = await res4.json();
  console.log("Login Error:", data4);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
