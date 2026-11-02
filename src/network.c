#include "server.h"

#include <arpa/inet.h>
#include <errno.h>
#include <sys/socket.h>
#include <unistd.h>

int create_listener(int port)
{
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    int enabled = 1;
    struct sockaddr_in address = {0};
    if (fd < 0) return -1;
    address.sin_family = AF_INET;
    address.sin_port = htons((unsigned short)port);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &enabled, sizeof enabled) < 0 ||
        bind(fd, (struct sockaddr *)&address, sizeof address) < 0 ||
        listen(fd, 128) < 0) {
        int saved_errno = errno;
        close(fd);
        errno = saved_errno;
        return -1;
    }
    return fd;
}
