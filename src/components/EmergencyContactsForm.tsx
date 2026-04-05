import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

const RELATIONSHIPS = ["Wife", "Husband", "Father", "Mother", "Brother", "Sister", "Son", "Daughter", "Friend", "Other"];

interface EmergencyContactsFormProps {
  contacts: EmergencyContact[];
  onChange: (contacts: EmergencyContact[]) => void;
}

const EmergencyContactsForm = ({ contacts, onChange }: EmergencyContactsFormProps) => {
  const addContact = () => {
    if (contacts.length >= 7) return;
    onChange([...contacts, { name: "", phone: "", relationship: "" }]);
  };

  const removeContact = (index: number) => {
    if (contacts.length <= 1) return;
    onChange(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof EmergencyContact, value: string) => {
    const updated = contacts.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Emergency Contacts *</h3>
        <span className="text-sm text-muted-foreground">{contacts.length}/7</span>
      </div>
      {contacts.map((contact, index) => (
        <div key={index} className="space-y-2 p-3 border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Contact {index + 1} {index === 0 && "*"}</span>
            {contacts.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeContact(index)}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <Input placeholder="Name" value={contact.name} onChange={(e) => updateContact(index, "name", e.target.value)} />
          <Input placeholder="Phone" value={contact.phone} onChange={(e) => updateContact(index, "phone", e.target.value)} />
          <Select value={contact.relationship} onValueChange={(v) => updateContact(index, "relationship", v)}>
            <SelectTrigger><SelectValue placeholder="Relationship" /></SelectTrigger>
            <SelectContent>
              {RELATIONSHIPS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      ))}
      {contacts.length < 7 && (
        <Button variant="outline" size="sm" onClick={addContact} className="w-full">
          <Plus size={14} className="mr-1" /> Add Contact
        </Button>
      )}
    </div>
  );
};

export default EmergencyContactsForm;
