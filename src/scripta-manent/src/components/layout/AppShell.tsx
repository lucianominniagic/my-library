'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';

// ─────────────────────────────────────────────────────────────────────────────
// Nav links
// ─────────────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Libreria', href: '/books' },
  { label: 'Tag', href: '/tags' },
  { label: 'Impostazioni', href: '/settings' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Hide nav on login page
  const hideNav = pathname === '/login';

  const userName = session?.user?.name ?? session?.user?.email ?? '';
  const avatarLetter = userName.charAt(0).toUpperCase() || 'U';

  function handleAvatarClick(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
  }
  function handleMenuClose() {
    setAnchorEl(null);
  }
  async function handleLogout() {
    handleMenuClose();
    await signOut({ callbackUrl: '/login' });
  }

  // ─── Drawer content ──────────────────────────────────────────────────────
  const drawerContent = (
    <Box sx={{ width: 240 }} role="presentation" onClick={() => setDrawerOpen(false)}>
      <Box sx={{ p: 2 }}>
        <Typography
          component={NextLink}
          href="/"
          variant="h6"
          sx={{ textDecoration: 'none', color: 'primary.main', fontWeight: 700 }}
        >
          📚 Scripta Manent
        </Typography>
      </Box>
      <Divider />
      <List>
        {NAV_LINKS.map((link) => (
          <ListItem key={link.href} disablePadding>
            <ListItemButton
              component={NextLink}
              href={link.href}
              selected={pathname.startsWith(link.href)}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <LogoutIcon sx={{ mr: 1, fontSize: 18 }} />
            <ListItemText primary="Esci" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  // ─── Main render ─────────────────────────────────────────────────────────
  return (
    <>
      {!hideNav && (
        <>
          <AppBar
            position="sticky"
            elevation={1}
            sx={{ bgcolor: 'primary.main' }}
          >
            <Toolbar>
              {/* Mobile hamburger */}
              <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                onClick={() => setDrawerOpen(true)}
                sx={{ mr: 1, display: { md: 'none' } }}
              >
                <MenuIcon />
              </IconButton>

              {/* Logo */}
              <Typography
                component={NextLink}
                href="/"
                variant="h6"
                sx={{
                  textDecoration: 'none',
                  color: 'inherit',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                📚 Scripta Manent
              </Typography>

              {/* Desktop nav links */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5, ml: 4 }}>
                {NAV_LINKS.map((link) => (
                  <Typography
                    key={link.href}
                    component={NextLink}
                    href={link.href}
                    sx={{
                      color: 'inherit',
                      textDecoration: 'none',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      fontWeight: pathname.startsWith(link.href) ? 700 : 400,
                      bgcolor: pathname.startsWith(link.href)
                        ? 'rgba(255,255,255,0.15)'
                        : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Box>

              {/* Spacer */}
              <Box sx={{ flexGrow: 1 }} />

              {/* Avatar + dropdown */}
              <IconButton onClick={handleAvatarClick} sx={{ p: 0.5 }} aria-label="profilo utente">
                <Avatar
                  sx={{
                    bgcolor: 'secondary.main',
                    width: 36,
                    height: 36,
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {avatarLetter}
                </Avatar>
              </IconButton>

              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {userName && (
                  <MenuItem disabled sx={{ fontSize: '0.85rem' }}>
                    {userName}
                  </MenuItem>
                )}
                {userName && <Divider />}
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1, fontSize: 18 }} />
                  Esci
                </MenuItem>
              </Menu>
            </Toolbar>
          </AppBar>

          {/* Mobile drawer */}
          <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          >
            {drawerContent}
          </Drawer>
        </>
      )}

      {/* Page content */}
      <Box
        component="main"
        sx={{
          minHeight: hideNav ? '100vh' : 'calc(100vh - 64px)',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
    </>
  );
}
