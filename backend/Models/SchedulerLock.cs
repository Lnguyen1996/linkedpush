namespace LinkedPushApi.Models;

public class SchedulerLock
{
    public int Id { get; set; }
    public string LockName { get; set; } = "";
    public DateTime AcquiredAt { get; set; }
    public string AcquiredByInstance { get; set; } = "";
}