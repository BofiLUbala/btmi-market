const http = require('http');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZjA1YTNlZS0zMGRmLTRmNWItYTY5Ni0xM2U1ZWFiMDMwMWIiLCJlbWFpbCI6ImNvbW1lcmNlLnRlc3RAdGJrbWFya2V0LmNvbSIsInJvbGUiOiJDT01NRVJDRV9BRE1JTiIsInNlc3Npb25fdmVyc2lvbiI6MCwiaXNzIjoidGJrLW1hcmtldC1hZG1pbiIsImF1ZCI6WyJhZG1pbiJdLCJleHAiOjE3ODk2NDkyMjIsImlhdCI6MTc4OTY0NTYyMn0.2F1PCmf_HRurGoqyLfkf6NIIX5BjWHeFZD2zSDQZIyU';

// Get shops
const req = http.request({
  hostname: '127.0.0.1', port: 8080,
  path: '/api/v1/businesses', method: 'GET',
  headers: {'Authorization': 'Bearer ' + token}
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try { const j = JSON.parse(d); console.log('Businesses:', JSON.stringify(j, null, 2).substring(0, 500)); }
    catch(e) { console.log(d.substring(0, 500)); }
  });
});
req.end();
