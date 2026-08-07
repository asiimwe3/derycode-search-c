CC = gcc
CFLAGS = -O2 -Wall -std=c11
TARGET = derycode-search

all: $(TARGET)

$(TARGET): server.c json.h search.h languages.h knowledge.h
	$(CC) $(CFLAGS) -o $(TARGET) server.c

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
