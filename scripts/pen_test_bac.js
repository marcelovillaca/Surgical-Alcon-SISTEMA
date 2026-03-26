async function testMassAssignment() {
  console.log("Auditing: Attempting Mass Assignment / Vertical Escalation...");
  
  // Simulated session of a 'visitador' (non-gerente)
  const visitadorAuthToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0cnFzbXlnb2tlZnRvcWh4dmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjUyMzgsImV4cCI6MjA4NjMwMTIzOH0.dclz97hSW0O1yJujdRJLARulTGrZc5WBlfkpcrmc8ZY"; 
  const userId = "b4071ef2-dccc-4a2b-b4e2-fe9c925c9973"; // Dummy-ish ID

  console.log("1. Trying to promote self to 'gerente' via user_roles insert...");
  const promoteResp = await fetch("https://dtrqsmygokeftoqhxvae.supabase.co/rest/v1/user_roles", {
    method: "POST",
    headers: {
      "apikey": visitadorAuthToken,
      "Authorization": `Bearer ${visitadorAuthToken}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({
      user_id: userId,
      role: "gerente"
    })
  });
  
  if (promoteResp.status === 403 || promoteResp.status === 401 || (promoteResp.status === 201 && promoteResp.statusText === "Created")) {
    console.log(`Status: ${promoteResp.status}. Result: ${promoteResp.status === 403 ? "SUCCESS: Access Denied" : "VULNERABLE: Role Inserted"}`);
  } else {
    console.log(`Status: ${promoteResp.status}. Unexpected response.`);
  }

  console.log("2. IDOR Test: Accessing another user's profile...");
  const otherUserId = "another-uuid-here";
  const idorResp = await fetch(`https://dtrqsmygokeftoqhxvae.supabase.co/rest/v1/profiles?user_id=eq.${otherUserId}`, {
    method: "GET",
    headers: {
      "apikey": visitadorAuthToken,
      "Authorization": `Bearer ${visitadorAuthToken}`
    }
  });
  
  const data = await idorResp.json();
  console.log(`IDOR Test status: ${idorResp.status}, Data length: ${data.length || 0}`);
  if (data.length === 0 || idorResp.status === 406) {
    console.log("IDOR Test Result: SUCCESS (No data returned / Access Denied by RLS)");
  } else {
    console.log("IDOR Test Result: VULNERABLE (Data leaked!)", JSON.stringify(data).substring(0, 100));
  }
}

testMassAssignment();
