/*
 * test_queue.c - P3 unit tests for the bounded client queue.
 * Uses plain integers instead of real sockets: the queue never touches
 * the fds it stores, so integers prove the same behaviour.
 */
#include "queue.h"

#include <assert.h>
#include <pthread.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define PRODUCERS 4
#define CONSUMERS 4
#define PER_PRODUCER 2500
#define TOTAL (PRODUCERS * PER_PRODUCER)

static void test_init_rejects_zero_capacity(void)
{
    assert(queue_init(0) == NULL);
    puts("ok  init rejects capacity 0");
}

static void test_fifo_order(void)
{
    struct client_queue *q = queue_init(4);
    int fd = -1;
    assert(q);
    assert(queue_try_push(q, 10));
    assert(queue_try_push(q, 11));
    assert(queue_try_push(q, 12));
    assert(queue_pop(q, &fd) && fd == 10);
    assert(queue_pop(q, &fd) && fd == 11);
    assert(queue_pop(q, &fd) && fd == 12);
    assert(queue_stats(q).pending == 0);
    queue_destroy(q);
    puts("ok  first in, first out");
}

static void test_full_rejects(void)
{
    struct client_queue *q = queue_init(4);
    assert(q);
    for (int i = 0; i < 4; i++) assert(queue_try_push(q, i));
    assert(!queue_try_push(q, 99));            /* 5th kid: rope line full */
    struct queue_snapshot s = queue_stats(q);
    assert(s.pending == 4 && s.capacity == 4 && !s.closed);
    queue_destroy(q);
    puts("ok  full queue rejects without blocking");
}

static void test_wraparound(void)
{
    struct client_queue *q = queue_init(3);
    int fd = -1;
    assert(q);
    for (int round = 0; round < 10; round++) {   /* head/tail go round the circle */
        assert(queue_try_push(q, round));
        assert(queue_try_push(q, round + 100));
        assert(queue_pop(q, &fd) && fd == round);
        assert(queue_pop(q, &fd) && fd == round + 100);
    }
    queue_destroy(q);
    puts("ok  circular buffer wraps around");
}

static void test_close_drains_then_stops(void)
{
    struct client_queue *q = queue_init(8);
    int fd = -1;
    assert(q);
    for (int i = 0; i < 5; i++) assert(queue_try_push(q, i));
    queue_close(q);
    assert(!queue_try_push(q, 42));             /* no new kids after closing */
    for (int i = 0; i < 5; i++) assert(queue_pop(q, &fd) && fd == i);
    assert(!queue_pop(q, &fd));                 /* drained: go home */
    assert(queue_stats(q).closed);
    queue_destroy(q);
    puts("ok  close drains queued items, then pop returns false");
}

/* ---- sleepers are woken by close ---- */
static void *sleeper(void *arg)
{
    int fd;
    bool got = queue_pop(arg, &fd);
    return (void *)(long)got;
}

static void test_close_wakes_sleepers(void)
{
    struct client_queue *q = queue_init(4);
    pthread_t t[CONSUMERS];
    struct timespec pause = {0, 50 * 1000 * 1000};
    assert(q);
    for (int i = 0; i < CONSUMERS; i++) assert(pthread_create(&t[i], NULL, sleeper, q) == 0);
    nanosleep(&pause, NULL);                    /* let them fall asleep on the empty queue */
    queue_close(q);
    for (int i = 0; i < CONSUMERS; i++) {
        void *got;
        assert(pthread_join(t[i], &got) == 0);  /* would hang forever if broadcast were missing */
        assert(got == (void *)0);
    }
    queue_destroy(q);
    puts("ok  close wakes every sleeping worker");
}

/* ---- many producers, many consumers: nothing lost, nothing doubled ---- */
struct stress { struct client_queue *q; int id; };
static unsigned char seen[TOTAL];
static pthread_mutex_t seen_lock = PTHREAD_MUTEX_INITIALIZER;
static long consumed;

static void *producer(void *arg)
{
    struct stress *s = arg;
    for (int i = 0; i < PER_PRODUCER; i++) {
        int value = s->id * PER_PRODUCER + i;
        while (!queue_try_push(s->q, value)) sched_yield();  /* test only: retry when full */
    }
    return NULL;
}

static void *consumer(void *arg)
{
    struct client_queue *q = arg;
    int value;
    while (queue_pop(q, &value)) {
        pthread_mutex_lock(&seen_lock);
        assert(value >= 0 && value < TOTAL);
        seen[value]++;
        consumed++;
        pthread_mutex_unlock(&seen_lock);
    }
    return NULL;
}

static void test_many_producers_consumers(void)
{
    struct client_queue *q = queue_init(16);
    pthread_t p[PRODUCERS], c[CONSUMERS];
    struct stress args[PRODUCERS];
    assert(q);
    memset(seen, 0, sizeof seen);
    consumed = 0;
    for (int i = 0; i < CONSUMERS; i++) assert(pthread_create(&c[i], NULL, consumer, q) == 0);
    for (int i = 0; i < PRODUCERS; i++) {
        args[i] = (struct stress){q, i};
        assert(pthread_create(&p[i], NULL, producer, &args[i]) == 0);
    }
    for (int i = 0; i < PRODUCERS; i++) pthread_join(p[i], NULL);
    queue_close(q);                             /* consumers drain the rest, then exit */
    for (int i = 0; i < CONSUMERS; i++) pthread_join(c[i], NULL);

    assert(consumed == TOTAL);
    for (int i = 0; i < TOTAL; i++) assert(seen[i] == 1);
    queue_destroy(q);
    printf("ok  %d producers x %d consumers: %d items, none lost or doubled\n",
           PRODUCERS, CONSUMERS, TOTAL);
}

int main(void)
{
    test_init_rejects_zero_capacity();
    test_fifo_order();
    test_full_rejects();
    test_wraparound();
    test_close_drains_then_stops();
    test_close_wakes_sleepers();
    test_many_producers_consumers();
    puts("ALL QUEUE TESTS PASSED");
    return 0;
}
