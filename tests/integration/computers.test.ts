/**
 * Computers integration tests
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ConnectWiseAutomateClient } from '../../src/client.js';
import { ConnectWiseAutomateNotFoundError } from '../../src/errors.js';
import { server } from '../mocks/server.js';
import * as fixtures from '../fixtures/index.js';

describe('Computers Resource', () => {
  const createClient = () =>
    new ConnectWiseAutomateClient({
      serverUrl: 'https://testserver.hostedrmm.com',
      clientId: 'test-client-id',
      credentials: {
        method: 'integrator',
        integratorUsername: 'test-user',
        integratorPassword: 'test-password',
      },
    });

  describe('list', () => {
    it('should list computers', async () => {
      const client = createClient();
      const response = await client.computers.list();

      expect(response.TotalRecords).toBe(3);
      expect(response.Data).toHaveLength(2);
      expect(response.Data[0]?.ComputerName).toBe('WORKSTATION-001');
    });

    it('should support pagination', async () => {
      const client = createClient();
      const page1 = await client.computers.list({ page: 1 });
      const page2 = await client.computers.list({ page: 2 });

      expect(page1.Data).toHaveLength(2);
      expect(page2.Data).toHaveLength(1);
      expect(page2.Data[0]?.ComputerName).toBe('LAPTOP-001');
    });
  });

  describe('listAll', () => {
    it('should iterate all computers from first page', async () => {
      const client = createClient();
      const computers = await client.computers.listAll().toArray();

      // The mock returns 2 items on page 1, which is less than pageSize (100),
      // so pagination stops after first page
      expect(computers).toHaveLength(2);
      expect(computers[0]?.ComputerName).toBe('WORKSTATION-001');
      expect(computers[1]?.ComputerName).toBe('SERVER-001');
    });
  });

  describe('get', () => {
    it('should get a single computer', async () => {
      const client = createClient();
      const computer = await client.computers.get(1);

      expect(computer.Id).toBe(1);
      expect(computer.ComputerName).toBe('WORKSTATION-001');
      expect(computer.OS).toBe('Windows 11 Pro');
      expect(computer.SerialNumber).toBe('ABC123456');
    });

    it('should throw NotFoundError for non-existent computer', async () => {
      const client = createClient();

      await expect(client.computers.get(999)).rejects.toThrow(ConnectWiseAutomateNotFoundError);
    });
  });

  describe('create', () => {
    it('should create a computer', async () => {
      const client = createClient();
      const computer = await client.computers.create({
        ComputerName: 'NEW-WORKSTATION',
        ClientId: 100,
        LocationId: 1,
      });

      expect(computer.Id).toBe(10);
      expect(computer.ComputerName).toBe('NEW-WORKSTATION');
    });
  });

  describe('update', () => {
    it('should update a computer', async () => {
      const client = createClient();
      const computer = await client.computers.update(1, {
        ComputerName: 'WORKSTATION-001-RENAMED',
        Comment: 'Updated comment',
      });

      expect(computer.ComputerName).toBe('WORKSTATION-001-RENAMED');
      expect(computer.Comment).toBe('Updated comment');
    });
  });

  describe('delete', () => {
    it('should delete a computer', async () => {
      const client = createClient();

      await expect(client.computers.delete(1)).resolves.toBeUndefined();
    });
  });

  describe('executeCommand', () => {
    it('should post the command as a nested catalog reference', async () => {
      const client = createClient();
      let sentBody: unknown;

      server.use(
        http.post(
          'https://testserver.hostedrmm.com/cwa/api/v1/Computers/:id/Commandexecute',
          async ({ request }) => {
            sentBody = await request.json();
            return HttpResponse.json(fixtures.computers.commandResult);
          }
        )
      );

      const result = await client.computers.executeCommand(1, {
        Command: { Id: '2' },
        Parameters: ['ipconfig /all'],
      });

      // The command must travel as an object carrying its catalog id, and the
      // computer id must be echoed into the body — a flat command string binds
      // to nothing server-side and the run terminates on arrival.
      expect(sentBody).toEqual({
        Command: { Id: '2' },
        Parameters: ['ipconfig /all'],
        ComputerId: 1,
      });
      expect(result.Command?.Id).toBe('2');
      expect(result.Status).toBe('Success');
    });
  });

  describe('commandHistory', () => {
    it('should return the bare array Automate sends', async () => {
      const client = createClient();

      server.use(
        http.get(
          'https://testserver.hostedrmm.com/cwa/api/v1/Computers/:id/Commandhistory',
          () => HttpResponse.json(fixtures.computers.commandHistory)
        )
      );

      const history = await client.computers.commandHistory(1);

      expect(Array.isArray(history)).toBe(true);
      expect(history[0]?.Status).toBe('Success');
      expect(history[0]?.DateFinished).toBe('2024-01-15T10:35:04Z');
    });
  });

  describe('commands', () => {
    it('should list the command catalog', async () => {
      const client = createClient();

      server.use(
        http.get('https://testserver.hostedrmm.com/cwa/api/v1/Commands', () =>
          HttpResponse.json(fixtures.computers.commandCatalog)
        )
      );

      const commands = await client.computers.commands();

      expect(commands).toHaveLength(2);
      expect(commands[1]?.Name).toBe('Command Prompt');
    });
  });

  describe('restart', () => {
    it('should restart a computer', async () => {
      const client = createClient();

      await expect(client.computers.restart(1)).resolves.toBeUndefined();
    });

    it('should restart with options', async () => {
      const client = createClient();

      await expect(client.computers.restart(1, true, 5)).resolves.toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown a computer', async () => {
      const client = createClient();

      await expect(client.computers.shutdown(1)).resolves.toBeUndefined();
    });
  });

  describe('wakeUp', () => {
    it('should wake up a computer', async () => {
      const client = createClient();

      await expect(client.computers.wakeUp(1)).resolves.toBeUndefined();
    });
  });
});
