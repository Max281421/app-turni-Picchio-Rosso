import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';

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
        setEmployee(data);
      } else {
        // Se la riga non esiste ancora in employees, usa i metadata di autenticazione
        const { data: userData } = await supabase.auth.getUser();
        const userObj = userData?.user;
        const email = userObj?.email || 'utente';
        
        const targetName = userObj?.user_metadata?.nome || email.split('@')[0];
        const targetRole = userObj?.user_metadata?.ruolo || 'dipendente';

        const { data: newEmp, error: createErr } = await supabase
          .from('employees')
          .upsert([{ id: authUserId, auth_user_id: authUserId, nome: targetName, ruolo: targetRole }], { onConflict: 'auth_user_id' })
          .select()
          .maybeSingle();

        if (newEmp) {
          setEmployee(newEmp);
        } else {
          console.warn('Fallback employee profile initialized:', createErr);
          setEmployee({ id: authUserId, auth_user_id: authUserId, nome: targetName, ruolo: targetRole });
        }
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

  const register = async (email, password, nome, ruolo = 'dipendente') => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configurato');

    let userObj = null;

    // 1. Tenta il SignUp inserendo i metadata
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome, ruolo }
      }
    });

    if (signUpErr) {
      if (signUpErr.message.includes('User already registered') || signUpErr.message.includes('already exists')) {
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInErr) throw signUpErr;
        userObj = signInData.user;
      } else {
        throw signUpErr;
      }
    } else {
      userObj = signUpData.user;
    }

    if (userObj) {
      await supabase.auth.updateUser({
        data: { nome, ruolo }
      });

      const { data: empData } = await supabase
        .from('employees')
        .upsert([
          {
            id: userObj.id,
            auth_user_id: userObj.id,
            nome,
            ruolo
          }
        ], { onConflict: 'auth_user_id' })
        .select()
        .maybeSingle();

      if (empData) {
        setEmployee(empData);
      } else {
        setEmployee({ id: userObj.id, auth_user_id: userObj.id, nome, ruolo });
      }
    }

    return userObj;
  };

  // Funzione per cambiare il ruolo di un utente (es. da Dipendente ad Admin)
  const updateEmployeeRole = async (employeeId, newRole) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const isSelf = employeeId === employee?.id || employeeId === employee?.auth_user_id || employeeId === user?.id;

      if (isSelf) {
        await supabase.auth.updateUser({
          data: { ruolo: newRole }
        });
      }

      const { data, error } = await supabase
        .from('employees')
        .update({ ruolo: newRole })
        .eq('id', employeeId)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('DB update role warning:', error);
      }

      if (isSelf) {
        setEmployee((prev) => prev ? { ...prev, ruolo: newRole } : { id: employeeId, auth_user_id: user?.id, ruolo: newRole });
      }
      return data || { ruolo: newRole };
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  // Funzione per cambiare il nome utente (Nome e Cognome)
  const updateEmployeeName = async (employeeId, newName) => {
    const supabase = getSupabaseClient();
    if (!supabase || !newName) return;

    const trimmedName = newName.trim();

    try {
      const isSelf = employeeId === employee?.id || employeeId === employee?.auth_user_id || employeeId === user?.id;

      if (isSelf) {
        await supabase.auth.updateUser({
          data: { nome: trimmedName }
        });
      }

      const { data, error } = await supabase
        .from('employees')
        .update({ nome: trimmedName })
        .eq('id', employeeId)
        .select()
        .maybeSingle();

      if (error) {
        console.warn('DB update name warning:', error);
      }

      if (isSelf) {
        setEmployee((prev) => prev ? { ...prev, nome: trimmedName } : { id: employeeId, auth_user_id: user?.id, nome: trimmedName });
      }

      return data || { nome: trimmedName };
    } catch (err) {
      console.error('Error updating name:', err);
    }
  };

  // Funzione per eliminare l'account o un dipendente
  const deleteAccount = async (targetEmployeeId) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const isSelf = employee?.id === targetEmployeeId || employee?.auth_user_id === user?.id;

      // 1. Elimina i turni associati
      await supabase
        .from('shifts')
        .delete()
        .eq('employee_id', targetEmployeeId);

      // 2. Elimina dalla tabella employees
      const { error: empError } = await supabase
        .from('employees')
        .delete()
        .or(`id.eq.${targetEmployeeId},auth_user_id.eq.${user?.id}`);

      if (empError) {
        console.warn('DB delete warning:', empError);
      }

      // 3. Se l'utente elimina se stesso, disconnetti la sessione
      if (isSelf) {
        await supabase.auth.signOut();
        setUser(null);
        setEmployee(null);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      if (employee?.id === targetEmployeeId || employee?.auth_user_id === user?.id) {
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
        loading,
        isConfigured,
        login,
        register,
        logout,
        updateEmployeeRole,
        updateEmployeeName,
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
