async function test() {
  console.log("--- 1. Testing admin@tbk.market ---");
  const res1 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@tbk.market", password: "SuperSecretAdmin2026!" })
  });
  console.log("Login 1 Status:", res1.status);
  const data1 = await res1.json();
  console.log("Login 1 Full Response:", JSON.stringify(data1, null, 2));

  const token = data1.token || data1.access_token || data1.data?.token || data1.data?.access_token || data1.data?.tokens?.access_token;
  if (token) {
    const meRes = await fetch("http://localhost:8080/api/v1/admin/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    console.log("Admin /me Status:", meRes.status);
    const meData = await meRes.json();
    console.log("Admin /me Data:", JSON.stringify(meData, null, 2));
  }

  console.log("\n--- 2. Testing alias admin@tbkmarket.com ---");
  const res2 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@tbkmarket.com", password: "SuperSecretAdmin2026!" })
  });
  console.log("Login 2 (alias) Status:", res2.status);
  const data2 = await res2.json();
  console.log("Login 2 Success:", data2.success);
  console.log("Login 2 Admin:", data2.data?.admin);

  console.log("\n--- 3. Testing wrong password ---");
  const res3 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@tbk.market", password: "WrongPassword123!" })
  });
  console.log("Login 3 (wrong pass) Status:", res3.status);
  const data3 = await res3.json();
  console.log("Login 3 Error:", data3);

  console.log("\n--- 4. Testing unknown email ---");
  const res4 = await fetch("http://localhost:8080/api/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@tbk.market", password: "SuperSecretAdmin2026!" })
  });
  console.log("Login 4 (unknown email) Status:", res4.status);
  const data4 = await res4.json();
  console.log("Login 4 Error:", data4);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
