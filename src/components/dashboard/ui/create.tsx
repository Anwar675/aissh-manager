"use client";

import * as React from "react";
import { IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Connection {
  id: string;
  name: string;
  environment: string;
  host: string;
  port: string;
  username: string;
  password?: string;
  privateKeyPath?: string;
  description?: string;
  createdAt: string;
}

const ENV_OPTIONS = [
  { value: "development", label: "Development" },
  { value: "staging", label: "Staging" },
  { value: "production", label: "Production" },
  { value: "testing", label: "Testing" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (connection: Connection) => void;
};

export function CreateSSHDialog({ open, onOpenChange, onCreate }: Props) {
  const [formData, setFormData] = React.useState({
    name: "",
    environment: "development",
    host: "",
    port: "22",
    username: "",
    password: "",
    privateKeyPath: "",
    description: "",
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

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const newConnection: Connection = {
      ...formData,
      id: Date.now().toString(),
      createdAt: new Date().toLocaleString(),
    };

    onCreate(newConnection);

    toast.success(`Connection "${newConnection.name}" created`);

    setFormData({
      name: "",
      environment: "development",
      host: "",
      port: "22",
      username: "",
      password: "",
      privateKeyPath: "",
      description: "",
    });

    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create SSH Connection</DialogTitle>

          <DialogDescription>Add a new SSH server</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div>
              <Label>Environment</Label>

              <Select
                value={formData.environment}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    environment: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {ENV_OPTIONS.map((env) => (
                    <SelectItem key={env.value} value={env.value}>
                      {env.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Host</Label>
            <Input
              value={formData.host}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  host: e.target.value,
                }))
              }
            />
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
              <Label>Username</Label>
              <Input
                value={formData.username}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
              />
            </div>
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
