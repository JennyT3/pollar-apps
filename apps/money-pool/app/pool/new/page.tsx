"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePollarAuth } from '../../../hooks/usePollarAuth';
import { LoginButton } from '../../../components/LoginButton';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';

export default function NewPoolPage() {
  const { user, isLoading } = usePollarAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <h1 className="text-2xl font-bold mb-4 text-center">Log in to create a Pool</h1>
        <LoginButton />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const goalAmount = formData.get('goalAmount') as string;
    const deadline = formData.get('deadline') as string;

    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-request': 'true' },
        body: JSON.stringify({
          name,
          description,
          goalAmount,
          deadline,
          organizerAddress: user!.address,
          organizerUserId: user!.address,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.error || 'Failed to create pool');
        setIsSubmitting(false);
        return;
      }

      const pool = await res.json();
      router.push(`/pool/${pool.id}`);
    } catch (err) {
      console.error(err);
      alert('An error occurred');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-4">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-center">Create a new Pool</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Name *
            </label>
            <Input id="name" name="name" required placeholder="My Awesome Pool" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="What is this pool for?"
              className="flex min-h-20 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div>
            <label htmlFor="goalAmount" className="block text-sm font-medium mb-1">
              Goal Amount (USDC) *
            </label>
            <Input
              id="goalAmount"
              name="goalAmount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="100.00"
            />
          </div>
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium mb-1">
              Deadline
            </label>
            <Input id="deadline" name="deadline" type="datetime-local" />
          </div>
          <Button type="submit" disabled={isSubmitting} className="mt-2">
            {isSubmitting ? 'Creating...' : 'Create Pool'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
