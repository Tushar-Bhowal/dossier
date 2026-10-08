import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/lib/api";
import { toast } from "@/components/ui/toast";

export function useSignOut(onSignedOut?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async function signOut() {
    try {
      await logout();
      // Cancel any in-flight queries first, then remove the "me" cache entry
      // entirely (not set to undefined — that triggers a refetch cycle which
      // causes the dashboard layout to flicker between loading/error states).
      await queryClient.cancelQueries({ queryKey: ["me"] });
      queryClient.removeQueries({ queryKey: ["me"] });
      onSignedOut?.();
      toast.success("Signed out successfully.");
      // replace, not push — prevents back-button bouncing to the dashboard
      router.replace("/login");
    } catch (err) {
      toast.error("Sign out failed. Please try again.");
      throw err;
    }
  };
}
