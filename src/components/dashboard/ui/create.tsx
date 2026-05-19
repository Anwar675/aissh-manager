"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Connection {
  id: string;

  name: string;
  description?: string;

  host: string;
  port: number;
  username: string;

  password?: string;
  sshKeyName?: string;
  passphrase?: string;
  pricePerHour?: number | null;

  createdAt: string;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  onCreate: (connection: Connection) => void;
};

export function CreateSSHDialog({ open, onOpenChange, onCreate }: Props) {
  const [formData, setFormData] = React.useState({
    name: "",

    host: "",
    port: "22",
    username: "",

    sshKeyName: "",
    passphrase: "",
    password: "",

    description: "",
    pricePerHour: "",
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Connection name is required";
    }

    if (!formData.host.trim()) {
      newErrors.host = "Host is required";
    }

    if (!formData.port.trim() || isNaN(Number(formData.port))) {
      newErrors.port = "Valid port is required";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }

    // phải có password hoặc ssh key
    if (!formData.password.trim() && !formData.sshKeyName.trim()) {
      newErrors.auth = "Password or SSH key name is required";
    }

    const pricePerHour =
      formData.pricePerHour.trim() === ""
        ? null
        : Number(formData.pricePerHour);

    if (pricePerHour !== null && (!Number.isFinite(pricePerHour) || pricePerHour < 0)) {
      newErrors.pricePerHour = "Valid price is required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      try {
        const response = await fetch("/api/ssh", {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name: formData.name,

            description: formData.description,

            host: formData.host,

            port: Number(formData.port),

            username: formData.username,

            password: formData.password || null,

            sshKeyName: formData.sshKeyName || null,

            passphrase: formData.passphrase || null,

            pricePerHour:
              formData.pricePerHour.trim() === ""
                ? null
                : Number(formData.pricePerHour),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create connection");
        }

        const data = await response.json();

        onCreate(data);

        toast.success(`Connection "${data.name}" created`);

        setFormData({
          name: "",
          host: "",
          port: "22",
          username: "",
          sshKeyName: "",
          passphrase: "",
          password: "",
          description: "",
          pricePerHour: "",
        });

        setErrors({});

        onOpenChange(false);
      } catch (error) {
        console.error(error);

        toast.error("Failed to save connection");
      }
    };

   

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create SSH Connection</DialogTitle>

          <DialogDescription>Add a new SSH server</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <Label>Connection Name</Label>

            <Input
              placeholder="vast-ai-a100"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
            />

            {errors.name && (
              <p className="text-sm text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username</Label>

              <Input
                placeholder="root"
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Host</Label>

              <Input
                placeholder="1.2.3.4"
                value={formData.host}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    host: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Port</Label>

              <Input
                value={formData.port}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    port: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>SSH Key Name</Label>

              <Input
                placeholder="vast-ai"
                value={formData.sshKeyName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sshKeyName: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Password</Label>

              <Input
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>Passphrase</Label>

              <Input
                type="password"
                value={formData.passphrase}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    passphrase: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          {errors.auth && <p className="text-sm text-red-500">{errors.auth}</p>}

          <div>
            <Label>Description</Label>

            <Input
              placeholder="VastAI A100 server"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label>Price/hour</Label>

            <Input
              inputMode="decimal"
              placeholder="0.50"
              value={formData.pricePerHour}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  pricePerHour: e.target.value,
                }))
              }
            />

            {errors.pricePerHour && (
              <p className="text-sm text-red-500 mt-1">
                {errors.pricePerHour}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit">Create</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
