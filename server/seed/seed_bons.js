import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ override: true });

const DEVICE_ID = process.env.SEED_DEVICE_ID || 'ab6g2349uf434b09';

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log('[seed] connecting and preparing demo data for device_id=', DEVICE_ID);

    // Ensure demo client exists
    await pool.query(
      `INSERT INTO clients (username, password, full_name, email, phone_number, statut, last_login, nbr_phones)
       VALUES (?, ?, ?, ?, ?, 'active', NOW(), 1)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone_number = VALUES(phone_number), statut='active'`,
      ['demo', 'demo', 'Demo Client', 'demo@example.com', '+213000000000']
    );
    const [[client]] = await pool.query(`SELECT client_id FROM clients WHERE username = ?`, ['demo']);
    const clientId = client?.client_id;
    if (!clientId) throw new Error('Failed to resolve demo client_id');

    // Ensure phone exists
    await pool.query(
      `INSERT INTO phones (phone_id, phone_name, client_id, last_update)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE phone_name = VALUES(phone_name), client_id = VALUES(client_id), last_update = NOW()`,
      [DEVICE_ID, 'Demo Device', clientId]
    );

    // Create BON1 header
    const numBon1 = '000001';
    await pool.query(
      `INSERT INTO BON1 (NUM_BON, CODE_CLIENT, DATE_BON, HEURE, NBR_P, TOT_QTE, MODE_TARIF, CODE_DEPOT, MODE_RG,
                         CODE_VENDEUR, TOT_HT, TOT_TVA, TIMBRE, TIMBRE_CHECK, LATITUDE, LONGITUDE, REMISE,
                         MONTANT_ACHAT, ANCIEN_SOLDE, EXPORTATION, BLOCAGE, VERSER, LIVRER, DATE_LIV,
                         IS_IMPORTED, IS_EXPORTED, phone_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE TOT_HT = VALUES(TOT_HT), TOT_QTE = VALUES(TOT_QTE), REMISE = VALUES(REMISE), phone_id = VALUES(phone_id)`,
      [
        numBon1,
        'C0001',
        '21/11/2025',
        '01:13:54',
        2,
        3,
        'TARIF 1',
        'DEPOT1',
        'ESPECES',
        'VEND001',
        105.0,
        0.0,
        0.0,
        'N',
        36.7525,
        3.04197,
        0.0,
        0.0,
        0.0,
        'N',
        'N',
        0.0,
        0,
        null,
        0,
        0,
        DEVICE_ID,
      ]
    );

    // Insert BON2 lines for NUM_BON 000001
    await pool.query(
      `INSERT INTO BON2 (CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['001', numBon1, '001 TEST', 0, 0, 0, 1, 105.0, 0.0, null, null, 0, 0.0, 'DEPOT1']
    );
    await pool.query(
      `INSERT INTO BON2 (CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['16P', numBon1, '16 P SOUMAM', 0, 0, 0, 2, 0.0, 0.0, null, null, 0, 0.0, 'DEPOT1']
    );

    // Create BON1_TEMP header
    const numBonTemp = 'T000001';
    await pool.query(
      `INSERT INTO BON1_TEMP (NUM_BON, CODE_CLIENT, DATE_BON, HEURE, NBR_P, TOT_QTE, MODE_TARIF, CODE_DEPOT, MODE_RG,
                              CODE_VENDEUR, TOT_HT, TOT_TVA, TIMBRE, TIMBRE_CHECK, LATITUDE, LONGITUDE, REMISE,
                              MONTANT_ACHAT, ANCIEN_SOLDE, EXPORTATION, BLOCAGE, VERSER, LIVRER, DATE_LIV,
                              IS_IMPORTED, IS_EXPORTED, phone_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE TOT_HT = VALUES(TOT_HT), TOT_QTE = VALUES(TOT_QTE), REMISE = VALUES(REMISE), phone_id = VALUES(phone_id)`,
      [
        numBonTemp,
        'C0001',
        '21/11/2025',
        '01:20:00',
        1,
        1,
        'TARIF 1',
        'DEPOT1',
        'ESPECES',
        'VEND001',
        50.0,
        0.0,
        0.0,
        'N',
        36.7525,
        3.04197,
        0.0,
        0.0,
        0.0,
        'N',
        'N',
        0.0,
        0,
        null,
        0,
        0,
        DEVICE_ID,
      ]
    );

    // Insert BON2_TEMP line for T000001
    await pool.query(
      `INSERT INTO BON2_TEMP (CODE_BARRE, NUM_BON, PRODUIT, NBRE_COLIS, COLISSAGE, QTE_GRAT, QTE, PV_HT, PA_HT, DESTOCK_TYPE, DESTOCK_CODE_BARRE, DESTOCK_QTE, TVA, CODE_DEPOT)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['002', numBonTemp, '002 DEMO', 0, 0, 0, 1, 50.0, 0.0, null, null, 0, 0.0, 'DEPOT1']
    );

    console.log('[seed] Bons created: BON1=', numBon1, ', BON1_TEMP=', numBonTemp);
  } catch (err) {
    console.error('[seed] error:', err);
    process.exitCode = 1;
  }
}

main();