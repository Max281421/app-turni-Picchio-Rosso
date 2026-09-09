const { createClient } = require('@supabase/supabase-js');

const url = 'https://aexlzsgmupwbyqwoyvoh.supabase.co';
const key = 'sb_publishable_RtEies-3GqL5H7KaV4oaqg_XfaTmZyr';

const supabase = createClient(url, key);

const dummyUsers = [
  { email: 'mario.rossi@pizzeria.it', password: 'Test123456!', nome: 'Mario Rossi' },
  { email: 'giuseppe.verdi@pizzeria.it', password: 'Test123456!', nome: 'Giuseppe Verdi' },
  { email: 'francesco.bianchi@pizzeria.it', password: 'Test123456!', nome: 'Francesco Bianchi' },
  { email: 'luca.ferrari@pizzeria.it', password: 'Test123456!', nome: 'Luca Ferrari' },
  { email: 'marco.russo@pizzeria.it', password: 'Test123456!', nome: 'Marco Russo' },
  { email: 'andrea.esposito@pizzeria.it', password: 'Test123456!', nome: 'Andrea Esposito' },
  { email: 'matteo.romano@pizzeria.it', password: 'Test123456!', nome: 'Matteo Romano' },
  { email: 'davide.colombo@pizzeria.it', password: 'Test123456!', nome: 'Davide Colombo' },
  { email: 'simone.ricci@pizzeria.it', password: 'Test123456!', nome: 'Simone Ricci' },
  { email: 'antonio.marino@pizzeria.it', password: 'Test123456!', nome: 'Antonio Marino' },
];

async function seedDummyAccounts() {
  console.log('Inizio creazione 10 account fittizi su Supabase Beta...\n');

  for (const u of dummyUsers) {
    try {
      // 1. Tenta la registrazione auth
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: u.email,
        password: u.password,
        options: {
          data: { nome: u.nome, ruolo: 'dipendente' }
        }
      });

      let userId = signUpData?.user?.id;

      if (signUpErr) {
        if (signUpErr.message.includes('User already registered') || signUpErr.message.includes('already exists')) {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: u.email,
            password: u.password
          });
          userId = signInData?.user?.id;
        } else {
          console.error(`Errore signup per ${u.email}:`, signUpErr.message);
          continue;
        }
      }

      if (userId) {
        // 2. Inserisci nella tabella employees se non esiste
        const { data: existingEmp } = await supabase
          .from('employees')
          .select('id')
          .eq('auth_user_id', userId)
          .maybeSingle();

        if (!existingEmp) {
          await supabase.from('employees').insert([
            { auth_user_id: userId, nome: u.nome, ruolo: 'dipendente' }
          ]);
        }
        console.log(`✅ Creato/Verificato account: ${u.nome} (${u.email})`);
      }
    } catch (err) {
      console.error(`Eccezione per ${u.email}:`, err.message);
    }
  }

  console.log('\nOperazione completata con successo!');
}

seedDummyAccounts();
