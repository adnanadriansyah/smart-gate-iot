const socket = io();

socket.on("gate_update", (data) => {
  console.log("Realtime:", data);

  document.getElementById("status").innerText = data.status;

  const row = `
    <tr>
      <td>${data.user_id}</td>
      <td>${data.status}</td>
      <td>${data.metode}</td>
      <td>${new Date(data.waktu).toLocaleString()}</td>
    </tr>
  `;

  document.getElementById("logTable").innerHTML =
    row + document.getElementById("logTable").innerHTML;
});
