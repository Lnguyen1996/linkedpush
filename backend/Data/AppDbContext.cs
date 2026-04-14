using Microsoft.EntityFrameworkCore;
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(e => e.LinkedInId).IsUnique();
        });

        modelBuilder.Entity<OAuthState>(entity =>
        {
            entity.HasKey(e => e.State);
            entity.HasIndex(e => e.CreatedAt);
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
    }
}
