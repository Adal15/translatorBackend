require('dotenv').config();
const { createClient } = require('@deepgram/sdk');
const dg = createClient(process.env.DEEPGRAM_API_KEY);
const st = dg.listen.live({ model: 'nova-3', language: 'ar' });

st.on('open', () => {
    console.log('OPEN');
    st.send(Buffer.from([0,0,0,0,0])); 
    setTimeout(() => st.finish(), 2000);
});

st.on('transcript', (data) => console.log('TRANSCRIPT EVENT', data));
st.on('transcriptReceived', (data) => console.log('TRANSCRIPTRECEIVED EVENT', data));
st.on('message', (data) => console.log('MESSAGE EVENT', data));
st.on('error', e => console.log('ERR', e.message, e.error || e.target));
st.on('close', () => console.log('CLOSE'));
