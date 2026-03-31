import { LayoutDashboard, CalendarPlus, MessageCircle, BarChart3, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navItemBase =
  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors";
const navItemActive = "border-primary/40 bg-primary text-primary-foreground";
const navItemInactive = "border-border bg-card hover:bg-accent hover:text-accent-foreground";

const AppMenuBar = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto max-w-7xl px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-tight">Clinic Appointment Hub</p>
              {user?.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <nav className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
            <NavLink
              to="/"
              className={cn(navItemBase, navItemInactive, "shrink-0 whitespace-nowrap")}
              activeClassName={navItemActive}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </NavLink>
            <NavLink
              to="/book-appointment"
              className={cn(navItemBase, navItemInactive, "shrink-0 whitespace-nowrap")}
              activeClassName={navItemActive}
            >
              <CalendarPlus className="h-4 w-4" />
              Book
            </NavLink>
            <NavLink
              to="/whatsapp-messages"
              className={cn(navItemBase, navItemInactive, "shrink-0 whitespace-nowrap")}
              activeClassName={navItemActive}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </NavLink>
            <NavLink
              to="/reports"
              className={cn(navItemBase, navItemInactive, "shrink-0 whitespace-nowrap")}
              activeClassName={navItemActive}
            >
              <BarChart3 className="h-4 w-4" />
              Reports
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default AppMenuBar;
