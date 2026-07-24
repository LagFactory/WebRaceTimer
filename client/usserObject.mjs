export class User {
  /**
     * Constructs (creates) or fetches a User via JSON API.
     * @param {{ id?: number, name?: string, nickname?: string,
     *            email?: string, phoneNumber?: string }} opts
     * @returns {Promise<User>} Resolves to user data
     */
  constructor(opts = {}) {
    return (async () => {
      // If an ID is provided, fetch existing user
      if (opts.id != null) {
        const response = await fetch(`/users/${opts.id}`);
        if (!response.ok) {
          throw new Error(`User ${opts.id} not found (status ${response.status})`);
        }
        const data = await response.json();
        Object.assign(this, data);
      } else {
        // Create new user
        const payload = {
          name: opts.name,
          nickname: opts.nickname ?? null,
          email: opts.email,
          phoneNumber: opts.phoneNumber ?? null, // server expects phoneNumber
        };
        const response = await fetch('/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || `Failed to create user (status ${response.status})`);
        }
        Object.assign(this, body);
      }
      return this;
    })();
  }
}
