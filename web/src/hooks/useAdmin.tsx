import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";

const OWNER_EMAIL = "audifyx@gmail.com";

export const useAdmin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAndAssignOwnerRole = useCallback(async () => {
    if (!user?.email || !user?.id) return false;
    
    // Check if this is the owner email
    if (user.email === OWNER_EMAIL) {
      try {
        // Call the database function to ensure owner role is assigned
        const { data, error } = await supabase.rpc('ensure_owner_role', {
          check_user_id: user.id,
          check_email: user.email
        });
        
        if (error) {
          console.error("Error ensuring owner role:", error);
          // Even if RPC fails, we know this is the owner email
          return true;
        }
        
        return true;
      } catch (err) {
        console.error("Error in owner role check:", err);
        // Fallback: if email matches, treat as owner
        return true;
      }
    }
    return false;
  }, [user]);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsOwner(false);
        setLoading(false);
        return;
      }

      try {
        // First check if this is the owner email - this takes priority
        const isOwnerEmail = user.email === OWNER_EMAIL;
        
        if (isOwnerEmail) {
          // Ensure the owner role exists in DB
          await checkAndAssignOwnerRole();
          setIsOwner(true);
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // Otherwise check the database for admin roles
        const { data, error } = await supabase
          .from("admin_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Admin check error:", error);
          setIsAdmin(false);
          setIsOwner(false);
        } else if (!data) {
          setIsAdmin(false);
          setIsOwner(false);
        } else {
          setIsAdmin(data.role === "admin" || data.role === "owner");
          setIsOwner(data.role === "owner");
        }
      } catch (error) {
        console.error("Admin check error:", error);
        setIsAdmin(false);
        setIsOwner(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, checkAndAssignOwnerRole]);

  return { isAdmin, isOwner, loading, ownerEmail: OWNER_EMAIL };
};
