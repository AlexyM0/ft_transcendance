-- Ajouter colonne avatar_url à la table users
ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL;

-- Avatar par défaut pour les utilisateurs existants
UPDATE users SET avatar_url = '/uploads/avatars/default-avatar.png' WHERE avatar_url IS NULL;