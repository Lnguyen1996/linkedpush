using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using LinkedPushApi.Models;

namespace LinkedPushApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<OAuthState> OAuthStates => Set<OAuthState>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Media> Media => Set<Media>();
    public DbSet<Analytics> Analytics => Set<Analytics>();
    public DbSet<PostMedia> PostMedia => Set<PostMedia>();
    public DbSet<SchedulerLock> SchedulerLocks => Set<SchedulerLock>();

    // Auth-migration foundation (planning docs 01, 04).
    public DbSet<Identity> Identities => Set<Identity>();
    public DbSet<SocialConnection> SocialConnections => Set<SocialConnection>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuthEvent> AuthEvents => Set<AuthEvent>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserNotificationPreference> NotificationPreferences => Set<UserNotificationPreference>();

    /// <summary>
    /// True when the active provider is Postgres. EF migrations use this to opt into
    /// Postgres-specific column types (<c>inet</c>, <c>jsonb</c>) and partial indexes
    /// while the InMemory provider used by tests stays happy with the default mapping.
    /// </summary>
    private bool IsPostgres => Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true;

    /// <summary>
    /// Bridges <see cref="string"/> properties (portable, easy to bind from JSON / requests)
    /// to the Postgres <c>inet</c> type so the planner can use it. <c>null</c> stays <c>null</c>;
    /// invalid input throws at write time, which surfaces malformed IPs early instead of
    /// silently storing junk.
    /// </summary>
    private static readonly ValueConverter<string?, IPAddress?> StringToInetConverter = new(
        v => v == null ? null : IPAddress.Parse(v),
        v => v == null ? null : v.ToString());

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.LinkedInId).IsUnique();
            // Partial unique index on email — only enforced on real Postgres; ignored on InMemory.
            if (IsPostgres)
            {
                entity.HasIndex(e => e.Email)
                    .IsUnique()
                    .HasFilter("email IS NOT NULL")
                    .HasDatabaseName("IX_users_email_unique_not_null");
            }
        });

        modelBuilder.Entity<OAuthState>(entity =>
        {
            entity.HasKey(e => e.State);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasOne(e => e.LinkUser)
                .WithMany()
                .HasForeignKey(e => e.LinkUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasOne(p => p.User)
                .WithMany(u => u.Posts)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(p => p.Image)
                .WithMany()
                .HasForeignKey(p => p.ImageId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Comment>(entity =>
        {
            entity.HasOne(c => c.Post)
                .WithOne(p => p.FirstComment)
                .HasForeignKey<Comment>(c => c.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Media>(entity =>
        {
            entity.HasOne(m => m.User)
                .WithMany(u => u.MediaItems)
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Analytics>(entity =>
        {
            entity.HasIndex(a => a.PostId).IsUnique();
            entity.HasOne(a => a.Post)
                .WithOne(p => p.Analytics)
                .HasForeignKey<Analytics>(a => a.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostMedia>(entity =>
        {
            entity.HasKey(pm => new { pm.PostId, pm.MediaId });

            entity.HasOne(pm => pm.Post)
                .WithMany(p => p.PostMedia)
                .HasForeignKey(pm => pm.PostId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(pm => pm.Media)
                .WithMany()
                .HasForeignKey(pm => pm.MediaId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SchedulerLock>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LockName).IsUnique();
            entity.HasIndex(e => e.AcquiredAt);
        });

        modelBuilder.Entity<Identity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.Provider, e.ProviderUserId }).IsUnique();
            entity.HasOne(e => e.User)
                .WithMany(u => u.Identities)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SocialConnection>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.Provider }).IsUnique();
            entity.HasIndex(e => new { e.Provider, e.ProviderUserId }).IsUnique();
            // Partial index for the LinkedIn token-refresh sweeper (Postgres only).
            if (IsPostgres)
            {
                entity.HasIndex(e => e.TokenExpiresAt)
                    .HasFilter("status = 'active'")
                    .HasDatabaseName("IX_social_connections_token_expires_active");
            }
            entity.HasOne(e => e.User)
                .WithMany(u => u.SocialConnections)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ExpiresAt);
            entity.HasIndex(e => e.ChainId);
            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ReplacedBy)
                .WithMany()
                .HasForeignKey(e => e.ReplacedById)
                .OnDelete(DeleteBehavior.SetNull);

            if (IsPostgres)
            {
                // Postgres native types preferred for the storage layer; InMemory fallback uses
                // the default string mapping declared by the [Column] attribute.
                entity.Property(e => e.IpAddress)
                    .HasColumnType("inet")
                    .HasConversion(StringToInetConverter);
            }
        });

        modelBuilder.Entity<AuthEvent>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => new { e.EventType, e.CreatedAt });
            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            if (IsPostgres)
            {
                entity.Property(e => e.IpAddress)
                    .HasColumnType("inet")
                    .HasConversion(StringToInetConverter);
                entity.Property(e => e.Metadata).HasColumnType("jsonb");
            }
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.CreatedAt });
            entity.HasIndex(e => new { e.UserId, e.ReadAt });
            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Post)
                .WithMany(p => p.Notifications)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<UserNotificationPreference>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.HasOne(e => e.User)
                .WithOne()
                .HasForeignKey<UserNotificationPreference>(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
