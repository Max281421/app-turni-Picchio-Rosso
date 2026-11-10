import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';
import { parseMansioni } from '../lib/whatsappExport';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const checkConfigAndInit = async () => {
    const creds = getSupabaseCredentials();
    setIsConfigured(creds.isConfigured);

    if (!creds.isConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchEmployeeProfile(session.user.id);
      } else {
        setUser(null);
        setEmployee(null);
      }
    } catch (err) {
      console.error('Error fetching session:', err);
    } finally {
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchEmployeeProfile(session.user.id);
      } else {
        setUser(null);
        setEmployee(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  };

  const getStoredMansioni = (empId, authUserId) => {
    try {
      if (empId) {
        const saved = localStorage.getItem(`APP_TURNI_MANSIONI_${empId}`);
        if (saved !== null) return JSON.parse(saved);
      }
      if (authUserId) {
        const saved = localStorage.getItem(`APP_TURNI_MANSIONI_${authUserId}`);
        if (saved !== null) return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  };

  const formatEmpWithMansioni = (emp) => {
    if (!emp) return null;
    const stored = getStoredMansioni(emp.id, emp.auth_user_id);
    const mansioni = stored !== null && Array.isArray(stored) ? stored : parseMansioni(emp.mansioni, emp.id || emp.auth_user_id);
    return { ...emp, mansioni };
  };

  const fetchEmployeeProfile = async (authUserId) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching employee profile:', error);
      }

      if (data) {
        setEmployee(formatEmpWithMansioni(data));
      } else {
        // Se l'utente è autenticato in Supabase ma la sua riga non esiste più in employees,
        // significa che l'account è stato eliminato dall'Admin: esegui il logout immediato,
        // azzera la sessione locale e impedisci l'auto-creazione non autorizzata.
        console.warn('Profilo dipendente non trovato in employees (account eliminato dall\'Admin). Disconnessione...');
        try {
          await supabase.auth.signOut();
        } catch (e) {}
        setUser(null);
        setEmployee(null);
      }
    } catch (err) {
      console.error('Exception fetching employee:', err);
    }
  };

  const login = async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configurato');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    if (data.user) {
      await fetchEmployeeProfile(data.user.id);
    }
    return data;
  };

  const register = async (email, password, nome, ruolo = 'dipendente', mansioni = ['cassa', 'fattorino', 'pizzeria']) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configurato');

    let userObj = null;

    // 1. Tenta il SignUp inserendo i metadata
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome, ruolo, mansioni }
      }
    });

    if (signUpErr) {
      throw signUpErr;
    }
    userObj = signUpData.user;

    if (userObj) {
      await supabase.auth.updateUser({
        data: { nome, ruolo, mansioni }
      });

      // 2. Inserimento sicuro in public.employees con .insert() che rispetta le policy RLS di registrazione
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .insert([{ auth_user_id: userObj.id, nome, ruolo, mansioni }])
        .select()
        .maybeSingle();

      if (empData) {
        setEmployee(empData);
      } else {
        // Se la insert ha dato errore (es. se già esistente), ricarica con .select()
        const { data: retryEmp } = await supabase
          .from('employees')
          .select('*')
          .eq('auth_user_id', userObj.id)
          .maybeSingle();

        if (retryEmp) {
          setEmployee(retryEmp);
        } else {
          console.warn('Fallback employee profile initialized:', empErr);
          setEmployee({ id: userObj.id, auth_user_id: userObj.id, nome, ruolo });
        }
      }
    }

    return userObj;
  };

  const checkIsSelf = (targetEmployeeId) => {
    if (!targetEmployeeId) return false;
    const adminEmpId = employee?.id;
    const adminAuthId = employee?.auth_user_id || user?.id;

    if (adminEmpId && String(targetEmployeeId) === String(adminEmpId)) return true;
    if (adminAuthId && String(targetEmployeeId) === String(adminAuthId)) return true;
    return false;
  };

  // Funzione per cambiare il ruolo di un utente (es. da Dipendente ad Admin)
  const updateEmployeeRole = async (employeeId, newRole) => {
    const supabase = getSupabaseClient();
    if (!supabase || !employeeId) return;

    const isSelf = checkIsSelf(employeeId);

    try {
      if (isSelf) {
        await supabase.auth.updateUser({
          data: { ruolo: newRole }
        });
      }

      let { data, error } = await supabase
        .from('employees')
        .update({ ruolo: newRole })
        .eq('id', employeeId)
        .select()
        .maybeSingle();

      if (!data) {
        const { data: dataAuth } = await supabase
          .from('employees')
          .update({ ruolo: newRole })
          .eq('auth_user_id', employeeId)
          .select()
          .maybeSingle();
        data = dataAuth;
      }

      if (isSelf) {
        setEmployee((prev) => (prev ? { ...prev, ruolo: newRole } : null));
      }
      return data || { ruolo: newRole };
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  // Funzione per cambiare il nome utente (Nome e Cognome)
  const updateEmployeeName = async (employeeId, newName) => {
    const supabase = getSupabaseClient();
    if (!supabase || !employeeId || !newName) return;

    const trimmedName = newName.trim();
    const isSelf = checkIsSelf(employeeId);

    try {
      if (isSelf) {
        await supabase.auth.updateUser({
          data: { nome: trimmedName }
        });
      }

      let { data } = await supabase
        .from('employees')
        .update({ nome: trimmedName })
        .eq('id', employeeId)
        .select()
        .maybeSingle();

      if (!data) {
        const { data: dataAuth } = await supabase
          .from('employees')
          .update({ nome: trimmedName })
          .eq('auth_user_id', employeeId)
          .select()
          .maybeSingle();
        data = dataAuth;
      }

      if (isSelf) {
        setEmployee((prev) => (prev ? { ...prev, nome: trimmedName } : null));
      }

      return data || { nome: trimmedName };
    } catch (err) {
      console.error('Error updating name:', err);
    }
  };

  // Funzione per aggiornare l'alias/soprannome per WhatsApp del dipendente
  const updateEmployeeAlias = async (employeeId, newAlias) => {
    const supabase = getSupabaseClient();
    if (!supabase || !employeeId) return;

    try {
      const trimmedAlias = (newAlias || '').trim();
      const isSelf = checkIsSelf(employeeId);

      let { data } = await supabase
        .from('employees')
        .update({ alias: trimmedAlias })
        .eq('id', employeeId)
        .select()
        .maybeSingle();

      if (!data) {
        const { data: dataAuth } = await supabase
          .from('employees')
          .update({ alias: trimmedAlias })
          .eq('auth_user_id', employeeId)
          .select()
          .maybeSingle();
        data = dataAuth;
      }

      if (isSelf) {
        setEmployee((prev) => (prev ? { ...prev, alias: trimmedAlias } : null));
      }

      return data || { alias: trimmedAlias };
    } catch (err) {
      console.error('Error updating alias:', err);
      throw err;
    }
  };

  // Funzione per aggiornare l'array delle mansioni operative (cassa, fattorino, pizzeria)
  const updateEmployeeMansioni = async (employeeId, newMansioni) => {
    const supabase = getSupabaseClient();
    if (!employeeId) return;

    try {
      const formattedMansioni = Array.isArray(newMansioni) ? newMansioni : [];
      const isSelf = checkIsSelf(employeeId);

      try {
        localStorage.setItem(`APP_TURNI_MANSIONI_${employeeId}`, JSON.stringify(formattedMansioni));
      } catch (e) {}

      let data = null;
      if (supabase) {
        try {
          const { data: d1 } = await supabase
            .from('employees')
            .update({ mansioni: formattedMansioni })
            .eq('id', employeeId)
            .select()
            .maybeSingle();

          data = d1;

          if (!data) {
            const { data: d2 } = await supabase
              .from('employees')
              .update({ mansioni: formattedMansioni })
              .eq('auth_user_id', employeeId)
              .select()
              .maybeSingle();
            data = d2;
          }
        } catch (dbErr) {
          console.warn('DB update mansioni error:', dbErr);
        }
      }

      if (isSelf) {
        setEmployee((prev) => (prev ? { ...prev, mansioni: formattedMansioni } : null));
      }

      return data || { mansioni: formattedMansioni };
    } catch (err) {
      console.error('Error updating mansioni:', err);
      return { mansioni: newMansioni };
    }
  };

  // Funzione per eliminare l'account o un dipendente
  const deleteAccount = async (targetEmployeeId) => {
    const supabase = getSupabaseClient();
    if (!supabase || !targetEmployeeId) return;

    const isSelf = checkIsSelf(targetEmployeeId);

    try {
      // 1. Elimina i turni e le notifiche del dipendente selezionato
      await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', targetEmployeeId);

      await supabase
        .from('planned_shifts')
        .delete()
        .eq('employee_id', targetEmployeeId);

      await supabase
        .from('push_subscriptions')
        .delete()
        .or(`employee_id.eq.${targetEmployeeId},auth_user_id.eq.${targetEmployeeId}`);

      // 2. Elimina la riga del dipendente selezionato dalla tabella employees
      let { error: empError } = await supabase
        .from('employees')
        .delete()
        .eq('id', targetEmployeeId);

      if (empError) {
        await supabase
          .from('employees')
          .delete()
          .eq('auth_user_id', targetEmployeeId);
      }

      // 3. Soltanto SE l'utente sta eliminando il PROPRIO account, disconnetti la sessione
      if (isSelf) {
        await supabase.auth.signOut();
        setUser(null);
        setEmployee(null);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      if (isSelf) {
        await supabase.auth.signOut();
        setUser(null);
        setEmployee(null);
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setEmployee(null);
  };

  useEffect(() => {
    checkConfigAndInit();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        employee,
        isAdmin: employee?.ruolo === 'admin',
        loading,
        isConfigured,
        login,
        register,
        logout,
        updateEmployeeRole,
        updateEmployeeName,
        updateEmployeeAlias,
        updateEmployeeMansioni,
        deleteAccount,
        refreshProfile: () => user && fetchEmployeeProfile(user.id),
        checkConfigAndInit
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
