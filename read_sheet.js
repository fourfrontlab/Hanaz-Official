const token = 'gwt_oFYbvLtIK3wPWGnwCiCxmEGmw4WahZL9';
async function test() {
  const actsRes = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'fastnPlatform__listActions',
        arguments: { connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9' }
      }
    })
  });
  const data = await actsRes.json();
  const acts = data.result.structuredContent.data;
  const getValues = acts.find(a => a.slug === 'getValues');

  const res = await fetch('https://mcp.fastn.dev', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'fastnPlatform__executeAction',
        arguments: {
          connectorId: '38d254e2-b92e-44f4-81cd-8251fd9373d9',
          actionId: getValues.id,
          connectionName: 'default',
          input: {
            spreadsheetId: '1y0-ZimyPt0G-h4z05eYmVCycnPe5A_38vHL3uAOwZvc',
            range: "'ResolveSync Incidents'!A1:Z5"
          }
        }
      }
    })
  });
  const d = await res.json();
  console.log('Sheet rows:', JSON.stringify(d.result?.structuredContent?.data?.response?.values, null, 2));
}
test();
