import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  RefreshCw, 
  Users, 
  BarChart3, 
  Settings,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/repricing', icon: RefreshCw, label: 'Repricing Rules' },
  { to: '/competitors', icon: Users, label: 'Competitors' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void }) {
  const location = useLocation();
  const { logout } = useAuth();
  const isMobile = useMobile();

  const content = (
    <>
      {/* Logo */}
      <div className={cn("p-4 border-b border-border flex items-center", isOpen ? "justify-between" : "justify-center")}>
        <div className={cn("flex items-center gap-3", !isOpen && "justify-center")}>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary-foreground" />
          </div>
          {isOpen && <span className="text-xl font-display font-bold text-foreground">Pricer Pro</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                isOpen ? "" : "justify-center",
                isActive && "bg-muted text-primary"
              )}
              onClick={() => isMobile && setIsOpen(false)}
            >
              <item.icon className="w-5 h-5" />
              {isOpen && <span className="font-medium">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <Button variant="ghost" className={cn("w-full flex items-center gap-3", !isOpen && "justify-center")} onClick={logout}>
          <LogOut className="w-5 h-5" />
          {isOpen && <span className="font-medium">Logout</span>}
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className={cn("fixed inset-0 z-40 bg-background/80 backdrop-blur-sm", isOpen ? "block" : "hidden")} onClick={() => setIsOpen(false)}>
        <aside className="fixed left-0 top-0 h-screen w-64 bg-background border-r border-border flex flex-col">
          {content}
        </aside>
      </div>
    );
  }

  return (
    <aside className={cn("h-screen bg-background border-r border-border flex flex-col transition-all duration-300", isOpen ? "w-64" : "w-20")}>
      {content}
    </aside>
  );
}
