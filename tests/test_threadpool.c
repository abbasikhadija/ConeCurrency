/*
 * test_threadpool.c - P3 unit tests for the worker thread pool.
 * Uses real descriptors (opened on /dev/null) because workers close() them.
 */
#include "queue.h"
#include "threadpool.h"

#include <assert.h>
#include <dirent.h>
#include <fcntl.h>
#include <pthread.h>
#include <sched.h>
#include <signal.h>
#include <stdio.h>
#include <time.h>
#include <unistd.h>

#define JOBS 2000
#define WORKERS 4
#define MAX_THREADS 64

static pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
static long handled;
static long invalid_fd;
static long signal_unblocked;
static pthread_t seen_threads[MAX_THREADS];
static int seen_count;
static long sleep_ns;

static int open_fd_count(void)
{
    int n = 0;
    DIR *dir = opendir("/proc/self/fd");
    assert(dir);
    while (readdir(dir)) n++;
    closedir(dir);
    return n;
}

/* Fake cashier job: check the fd is open and signals are blocked, count it. */
static void fake_handler(int fd)
{
    sigset_t mask;
    pthread_sigmask(SIG_BLOCK, NULL, &mask);
    if (sleep_ns) { struct timespec t = {0, sleep_ns}; nanosleep(&t, NULL); }

    pthread_mutex_lock(&lock);
    handled++;
    if (fcntl(fd, F_GETFD) == -1) invalid_fd++;
    if (!sigismember(&mask, SIGINT) || !sigismember(&mask, SIGTERM)) signal_unblocked++;
    bool known = false;
    for (int i = 0; i < seen_count; i++)
        if (pthread_equal(seen_threads[i], pthread_self())) known = true;
    if (!known && seen_count < MAX_THREADS) seen_threads[seen_count++] = pthread_self();
    pthread_mutex_unlock(&lock);
}

static void reset(long ns)
{
    handled = invalid_fd = signal_unblocked = 0;
    seen_count = 0;
    sleep_ns = ns;
}

static void test_rejects_bad_arguments(void)
{
    struct client_queue *q = queue_init(4);
    assert(q);
    assert(pool_start(0, q, fake_handler) == NULL);
    assert(pool_start(-1, q, fake_handler) == NULL);
    assert(pool_start(2, NULL, fake_handler) == NULL);
    assert(pool_start(2, q, NULL) == NULL);
    queue_destroy(q);
    puts("ok  rejects 0 workers, missing queue, missing handler");
}

static void test_stop_with_no_jobs(void)
{
    struct client_queue *q = queue_init(4);
    assert(q);
    struct thread_pool *p = pool_start(WORKERS, q, fake_handler);
    assert(p);
    queue_close(q);
    pool_stop(p);                     /* would hang if sleepers were not woken */
    queue_destroy(q);
    puts("ok  idle workers shut down without hanging");
}

static void test_every_job_once_and_no_fd_leak(void)
{
    int before = open_fd_count();
    struct client_queue *q = queue_init(32);
    assert(q);
    reset(0);
    struct thread_pool *p = pool_start(WORKERS, q, fake_handler);
    assert(p);

    for (int i = 0; i < JOBS; i++) {
        int fd = open("/dev/null", O_RDONLY);
        assert(fd >= 0);
        while (!queue_try_push(q, fd)) sched_yield();  /* test only: wait for space */
    }
    queue_close(q);
    pool_stop(p);
    queue_destroy(q);

    assert(handled == JOBS);
    assert(invalid_fd == 0);
    assert(open_fd_count() == before);   /* every fd was closed exactly by its worker */
    printf("ok  %d jobs handled exactly once, all %d descriptors closed\n", JOBS, JOBS);
}

static void test_work_is_spread_and_signals_blocked(void)
{
    struct client_queue *q = queue_init(64);
    assert(q);
    reset(5L * 1000 * 1000);           /* 5 ms of fake work per client */
    struct thread_pool *p = pool_start(WORKERS, q, fake_handler);
    assert(p);
    for (int i = 0; i < 40; i++) {
        int fd = open("/dev/null", O_RDONLY);
        assert(fd >= 0 && queue_try_push(q, fd));
    }
    queue_close(q);
    pool_stop(p);
    queue_destroy(q);

    assert(handled == 40);
    assert(seen_count == WORKERS);       /* all 4 cashiers served someone */
    assert(signal_unblocked == 0);       /* Ctrl+C can never land on a worker */

    sigset_t mask;                       /* caller's mask was restored */
    pthread_sigmask(SIG_BLOCK, NULL, &mask);
    assert(!sigismember(&mask, SIGINT));
    printf("ok  work spread across all %d workers; SIGINT/SIGTERM blocked in workers only\n", WORKERS);
}

int main(void)
{
    test_rejects_bad_arguments();
    test_stop_with_no_jobs();
    test_every_job_once_and_no_fd_leak();
    test_work_is_spread_and_signals_blocked();
    puts("ALL THREADPOOL TESTS PASSED");
    return 0;
}
