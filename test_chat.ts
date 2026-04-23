async function test() {
  const res = await fetch("http://127.0.0.1:8787/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Qual o meu plano secreto?" })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
