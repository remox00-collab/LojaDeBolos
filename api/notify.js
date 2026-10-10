// Função do Vercel: envia o aviso de novo pedido para os aparelhos do admin.
// Variável de ambiente necessária no Vercel: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço)
const admin = require('firebase-admin');

function init() {
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });
  try {
    init();
    const authz = req.headers.authorization || '';
    const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'sem token' });
    const decoded = await admin.auth().verifyIdToken(idToken);

    const orderId = req.body && req.body.orderId;
    if (!orderId) return res.status(400).json({ error: 'sem orderId' });

    const db = admin.firestore();
    const ref = db.collection('orders').doc(String(orderId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'pedido não encontrado' });
    const o = snap.data();

    if (o.userId !== decoded.uid) return res.status(403).json({ error: 'pedido de outro usuário' });
    if (o.pushSentAt) return res.status(200).json({ ok: true, skipped: true });
    const created = o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : 0;
    if (Date.now() - created > 5 * 60 * 1000) return res.status(400).json({ error: 'pedido antigo' });

    await ref.update({ pushSentAt: admin.firestore.FieldValue.serverTimestamp() });

    const tokSnap = await db.collection('adminTokens').get();
    const tokens = tokSnap.docs.map((d) => d.id);
    if (!tokens.length) return res.status(200).json({ ok: true, sent: 0 });

    const total = Number(o.total).toFixed(2).replace('.', ',');
    const result = await admin.messaging().sendEachForMulticast({
      tokens,
      data: {
        title: 'Novo pedido — Doces & Cia',
        body: `${o.customerName || 'Cliente'} — R$ ${total}`,
        orderId: String(orderId)
      },
      webpush: { headers: { Urgency: 'high', TTL: '3600' } }
    });

    // remove aparelhos que não existem mais
    const dead = [];
    result.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]);
    });
    await Promise.all(dead.map((t) => db.collection('adminTokens').doc(t).delete()));

    return res.status(200).json({ ok: true, sent: result.successCount });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'erro interno' });
  }
};
